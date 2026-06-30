"""FastAPI 后端 API"""
import asyncio
import os
from datetime import datetime
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from database import (
    init_db,
    get_accounts,
    get_account,
    create_account,
    update_account,
    delete_account,
    get_groups,
    update_group,
    get_templates,
    create_template,
    update_template,
    delete_template,
    get_logs,
    get_settings,
    update_settings,
    get_stats,
)
from bot_manager import get_bot_manager, start_bot, stop_bot, stop_all_bots


# ─── WebSocket 广播管理 ────────────────────────────────────


class ConnectionManager:
    def __init__(self):
        self.connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.append(ws)

    def disconnect(self, ws: WebSocket):
        self.connections.remove(ws)

    async def broadcast(self, data: dict):
        for conn in self.connections:
            try:
                await conn.send_json(data)
            except Exception:
                pass


ws_manager = ConnectionManager()


# ─── 生命周期 ──────────────────────────────────────────────


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield
    await stop_all_bots()


app = FastAPI(title="TG Ad Bot", lifespan=lifespan)

# 允许跨域（前端开发模式）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静态文件（生产模式）
STATIC_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")


# ─── 请求模型 ──────────────────────────────────────────────


class AccountCreate(BaseModel):
    phone: str
    api_id: str
    api_hash: str
    session_name: str
    reply_message: str = ""


class AccountUpdate(BaseModel):
    reply_message: Optional[str] = None


class GroupUpdate(BaseModel):
    enabled: Optional[bool] = None
    interval_minutes: Optional[int] = None
    message_template_id: Optional[int] = None


class TemplateCreate(BaseModel):
    name: str
    content: str
    forward_url: str = ""


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    content: Optional[str] = None
    forward_url: Optional[str] = None


class LoginRequest(BaseModel):
    phone: str
    code: Optional[str] = None
    password: Optional[str] = None


class SettingsUpdate(BaseModel):
    settings: dict


# ─── 统计 API ──────────────────────────────────────────────


@app.get("/api/stats")
async def api_get_stats():
    return await get_stats()


# ─── 账号 API ──────────────────────────────────────────────


@app.get("/api/accounts")
async def api_get_accounts():
    return await get_accounts()


@app.post("/api/accounts")
async def api_create_account(data: AccountCreate):
    account_id = await create_account(
        data.phone, data.api_id, data.api_hash, data.session_name, data.reply_message
    )
    return {"id": account_id, "message": "账号创建成功"}


@app.put("/api/accounts/{account_id}")
async def api_update_account(account_id: int, data: AccountUpdate):
    updates = data.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(400, "未提供更新字段")
    await update_account(account_id, **updates)
    return {"message": "更新成功"}


@app.delete("/api/accounts/{account_id}")
async def api_delete_account(account_id: int):
    await stop_bot(account_id)
    await delete_account(account_id)
    return {"message": "账号已删除"}


@app.post("/api/accounts/{account_id}/login")
async def api_login_account(account_id: int, data: LoginRequest):
    mgr = get_bot_manager(account_id)
    try:
        result = await mgr.login(data.phone, data.code, data.password)
        return result
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/accounts/{account_id}/start")
async def api_start_bot(account_id: int):
    try:
        await start_bot(account_id)
        await ws_manager.broadcast(
            {"type": "status", "account_id": account_id, "status": "running"}
        )
        return {"message": "Bot 已启动"}
    except Exception as e:
        raise HTTPException(400, str(e))


@app.post("/api/accounts/{account_id}/stop")
async def api_stop_bot(account_id: int):
    await stop_bot(account_id)
    await ws_manager.broadcast(
        {"type": "status", "account_id": account_id, "status": "stopped"}
    )
    return {"message": "Bot 已停止"}


@app.post("/api/accounts/{account_id}/sync-groups")
async def api_sync_groups(account_id: int):
    mgr = get_bot_manager(account_id)
    if not mgr.client or not mgr.client.is_connected():
        # 尝试连接
        account = await get_account(account_id)
        if not account:
            raise HTTPException(404, "账号不存在")
        from telethon import TelegramClient

        session_path = f"data/sessions/{account['session_name']}"
        mgr.client = TelegramClient(
            session_path, int(account["api_id"]), account["api_hash"]
        )
        await mgr.client.connect()
        if not await mgr.client.is_user_authorized():
            raise HTTPException(400, "账号未登录，请先登录")

    count = await mgr.sync_groups()
    return {"message": f"同步成功，发现 {count} 个群组"}


# ─── 群组 API ──────────────────────────────────────────────


@app.get("/api/groups")
async def api_get_groups(account_id: Optional[int] = None):
    return await get_groups(account_id)


@app.put("/api/groups/{group_id}")
async def api_update_group(group_id: int, data: GroupUpdate):
    updates = {}
    if data.enabled is not None:
        updates["enabled"] = 1 if data.enabled else 0
    if data.interval_minutes is not None:
        updates["interval_minutes"] = data.interval_minutes
    if data.message_template_id is not None:
        updates["message_template_id"] = data.message_template_id
    if not updates:
        raise HTTPException(400, "未提供更新字段")
    await update_group(group_id, **updates)
    return {"message": "更新成功"}


@app.put("/api/groups/batch")
async def api_batch_update_groups(group_ids: list[int], data: GroupUpdate):
    updates = {}
    if data.enabled is not None:
        updates["enabled"] = 1 if data.enabled else 0
    if data.interval_minutes is not None:
        updates["interval_minutes"] = data.interval_minutes
    if data.message_template_id is not None:
        updates["message_template_id"] = data.message_template_id
    for gid in group_ids:
        await update_group(gid, **updates)
    return {"message": f"批量更新 {len(group_ids)} 个群组"}


# ─── 消息模板 API ──────────────────────────────────────────


@app.get("/api/templates")
async def api_get_templates():
    return await get_templates()


@app.post("/api/templates")
async def api_create_template(data: TemplateCreate):
    template_id = await create_template(data.name, data.content, data.forward_url)
    return {"id": template_id, "message": "模板创建成功"}


@app.put("/api/templates/{template_id}")
async def api_update_template(template_id: int, data: TemplateUpdate):
    updates = data.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(400, "未提供更新字段")
    await update_template(template_id, **updates)
    return {"message": "更新成功"}


@app.delete("/api/templates/{template_id}")
async def api_delete_template(template_id: int):
    await delete_template(template_id)
    return {"message": "模板已删除"}


# ─── 日志 API ──────────────────────────────────────────────


@app.get("/api/logs")
async def api_get_logs(
    limit: int = 100, status: Optional[str] = None, account_id: Optional[int] = None
):
    return await get_logs(limit, status, account_id)


# ─── 设置 API ──────────────────────────────────────────────


@app.get("/api/settings")
async def api_get_settings():
    return await get_settings()


@app.put("/api/settings")
async def api_update_settings(data: SettingsUpdate):
    await update_settings(data.settings)
    return {"message": "设置已保存"}


# ─── WebSocket 实时推送 ─────────────────────────────────────


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws_manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)


# ─── 前端 SPA Fallback ─────────────────────────────────────


@app.get("/{path:path}")
async def spa_fallback(path: str):
    from fastapi.responses import FileResponse

    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "TG Ad Bot API 正在运行", "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
