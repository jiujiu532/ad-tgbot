"""Telegram Bot 核心管理器"""
import asyncio
import re
from datetime import datetime, timedelta
from typing import Dict
from telethon import TelegramClient, events
from telethon.tl import types
from telethon.errors import FloodWaitError, PeerFloodError, UserPrivacyRestrictedError
import random

from database import (
    get_account,
    get_enabled_groups,
    update_account,
    update_group,
    add_log,
    get_settings,
)


class BotManager:
    """Bot 管理器 - 每个账号一个实例"""

    def __init__(self, account_id: int):
        self.account_id = account_id
        self.client: TelegramClient = None
        self.running = False
        self.task = None

    async def start(self):
        """启动 Bot"""
        if self.running:
            return

        account = await get_account(self.account_id)
        if not account:
            raise ValueError("账号不存在")

        # 创建 Telethon 客户端
        session_path = f"data/sessions/{account['session_name']}"
        self.client = TelegramClient(
            session_path, int(account["api_id"]), account["api_hash"]
        )

        try:
            await self.client.connect()
            if not await self.client.is_user_authorized():
                await update_account(self.account_id, status="需要登录")
                raise ValueError("需要先登录账号")

            # 注册私信自动回复
            @self.client.on(events.NewMessage(incoming=True))
            async def reply_handler(event):
                if isinstance(event.message.peer_id, types.PeerUser):
                    try:
                        if account["reply_message"]:
                            await event.reply(account["reply_message"])
                            sender = await event.get_sender()
                            await add_log(
                                self.account_id,
                                str(sender.id),
                                f"私信-{sender.username or sender.id}",
                                "success",
                                "自动回复私信",
                            )
                    except Exception as e:
                        pass

            self.running = True
            await update_account(self.account_id, status="running")

            # 启动发送任务
            self.task = asyncio.create_task(self._send_loop())

        except Exception as e:
            await update_account(self.account_id, status=f"错误: {str(e)}")
            raise

    async def stop(self):
        """停止 Bot"""
        self.running = False
        if self.task:
            self.task.cancel()
            try:
                await self.task
            except asyncio.CancelledError:
                pass
        if self.client:
            await self.client.disconnect()
        await update_account(self.account_id, status="stopped")

    async def _send_loop(self):
        """发送循环"""
        while self.running:
            try:
                groups = await get_enabled_groups(self.account_id)
                settings = await get_settings()

                if not groups:
                    await asyncio.sleep(60)
                    continue

                # 获取设置
                start_hour = int(settings.get("send_start_hour", 0))
                end_hour = int(settings.get("send_end_hour", 24))
                random_enabled = settings.get("random_delay_enabled", "1") == "1"
                random_min = int(settings.get("random_delay_min", 25))
                random_max = int(settings.get("random_delay_max", 35))

                for group in groups:
                    if not self.running:
                        break

                    # 检查时间限制
                    now = datetime.now()
                    if not (start_hour <= now.hour < end_hour):
                        await asyncio.sleep(60)
                        continue

                    # 检查间隔时间
                    if group["last_sent_at"]:
                        last_sent = datetime.fromisoformat(group["last_sent_at"])
                        interval = timedelta(minutes=group["interval_minutes"])
                        next_send = last_sent + interval
                        if now < next_send:
                            continue

                    # 发送消息
                    await self._send_to_group(group)

                    # 随机延迟
                    if random_enabled:
                        delay = random.randint(random_min, random_max) * 60
                    else:
                        delay = group["interval_minutes"] * 60

                    await asyncio.sleep(delay)

                # 一轮结束，短暂休息
                await asyncio.sleep(60)

            except asyncio.CancelledError:
                break
            except Exception as e:
                await add_log(
                    self.account_id, "", "系统", "failed", "", f"发送循环错误: {str(e)}"
                )
                await asyncio.sleep(300)

    async def _send_to_group(self, group: dict):
        """向单个群发送消息"""
        group_id = int(group["group_id"])
        group_title = group["title"]

        try:
            # 判断是转发还是发送文字
            if group["template_forward_url"]:
                # 转发消息
                match = re.match(
                    r"https://t.me/s/([^/]+)/(\d+)", group["template_forward_url"]
                )
                if match:
                    channel = match.group(1)
                    msg_id = int(match.group(2))
                    messages = await self.client.get_messages(channel, ids=msg_id)
                    await self.client.forward_messages(group_id, messages)
                else:
                    raise ValueError("转发链接格式错误")
            else:
                # 发送文字
                content = group["template_content"] or "默认广告内容"
                await self.client.send_message(group_id, content)

            # 记录成功
            await update_group(group["id"], last_sent_at=datetime.now().isoformat())
            await add_log(
                self.account_id, str(group_id), group_title, "success", "发送成功"
            )

        except FloodWaitError as e:
            # Flood 等待
            wait_time = e.seconds
            await update_account(self.account_id, status=f"FloodWait {wait_time}s")
            await add_log(
                self.account_id,
                str(group_id),
                group_title,
                "failed",
                "",
                f"FloodWait: 需等待 {wait_time} 秒",
            )
            await asyncio.sleep(wait_time)

        except PeerFloodError:
            # 账号被限制
            await update_account(self.account_id, status="PeerFlood - 已暂停")
            await add_log(
                self.account_id,
                str(group_id),
                group_title,
                "failed",
                "",
                "PeerFlood: 账号被限制",
            )
            self.running = False

        except UserPrivacyRestrictedError:
            await add_log(
                self.account_id,
                str(group_id),
                group_title,
                "failed",
                "",
                "用户隐私限制",
            )

        except Exception as e:
            await add_log(
                self.account_id,
                str(group_id),
                group_title,
                "failed",
                "",
                str(e),
            )

    async def sync_groups(self):
        """同步账号的所有群组"""
        from database import sync_groups

        dialogs = await self.client.get_dialogs()
        groups_data = []
        for dialog in dialogs:
            if dialog.is_group:
                groups_data.append(
                    {
                        "id": dialog.id,
                        "title": dialog.title,
                        "username": dialog.entity.username
                        if hasattr(dialog.entity, "username")
                        else "",
                    }
                )
        await sync_groups(self.account_id, groups_data)
        return len(groups_data)

    async def login(self, phone: str, code: str = None, password: str = None):
        """登录账号"""
        account = await get_account(self.account_id)
        session_path = f"data/sessions/{account['session_name']}"
        self.client = TelegramClient(
            session_path, int(account["api_id"]), account["api_hash"]
        )
        await self.client.connect()

        if not code:
            # 发送验证码
            await self.client.send_code_request(phone)
            return {"status": "code_sent"}
        else:
            # 验证登录
            try:
                await self.client.sign_in(phone, code)
                await update_account(self.account_id, status="已登录")
                return {"status": "success"}
            except Exception as e:
                if "password" in str(e).lower() and password:
                    await self.client.sign_in(password=password)
                    await update_account(self.account_id, status="已登录")
                    return {"status": "success"}
                raise


# ─── 全局 Bot 管理器字典 ───────────────────────────────────────

_bot_managers: Dict[int, BotManager] = {}


def get_bot_manager(account_id: int) -> BotManager:
    """获取或创建 Bot 管理器"""
    if account_id not in _bot_managers:
        _bot_managers[account_id] = BotManager(account_id)
    return _bot_managers[account_id]


async def start_bot(account_id: int):
    """启动指定账号的 Bot"""
    mgr = get_bot_manager(account_id)
    await mgr.start()


async def stop_bot(account_id: int):
    """停止指定账号的 Bot"""
    if account_id in _bot_managers:
        await _bot_managers[account_id].stop()


async def stop_all_bots():
    """停止所有 Bot"""
    for mgr in _bot_managers.values():
        await mgr.stop()
