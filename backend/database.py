"""数据库操作层 - SQLite + aiosqlite"""
import aiosqlite
import os
from datetime import datetime

DB_PATH = os.environ.get("DB_PATH", "data/tgbot.db")


async def get_db() -> aiosqlite.Connection:
    db = await aiosqlite.connect(DB_PATH)
    db.row_factory = aiosqlite.Row
    return db


async def init_db():
    """初始化数据库表"""
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    db = await get_db()
    try:
        await db.executescript("""
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                phone TEXT UNIQUE NOT NULL,
                api_id TEXT NOT NULL,
                api_hash TEXT NOT NULL,
                session_name TEXT NOT NULL,
                reply_message TEXT DEFAULT '',
                status TEXT DEFAULT 'stopped',
                created_at TEXT DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER NOT NULL,
                group_id TEXT NOT NULL,
                title TEXT DEFAULT '',
                username TEXT DEFAULT '',
                enabled INTEGER DEFAULT 0,
                interval_minutes INTEGER DEFAULT 30,
                message_template_id INTEGER,
                last_sent_at TEXT,
                FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
                UNIQUE(account_id, group_id)
            );

            CREATE TABLE IF NOT EXISTS message_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                content TEXT NOT NULL,
                forward_url TEXT DEFAULT '',
                created_at TEXT DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER,
                group_id TEXT,
                group_title TEXT,
                status TEXT NOT NULL,
                message TEXT DEFAULT '',
                error TEXT DEFAULT '',
                created_at TEXT DEFAULT (datetime('now','localtime'))
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        """)
        # 插入默认设置
        defaults = [
            ("send_start_hour", "0"),
            ("send_end_hour", "24"),
            ("random_delay_enabled", "1"),
            ("random_delay_min", "25"),
            ("random_delay_max", "35"),
            ("notify_on_fail", "1"),
            ("notify_on_ban", "1"),
            ("notify_admin_user", ""),
        ]
        for key, value in defaults:
            await db.execute(
                "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
                (key, value),
            )
        await db.commit()
    finally:
        await db.close()


# ─── 账号 CRUD ─────────────────────────────────────────────

async def get_accounts():
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM accounts ORDER BY id")
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


async def get_account(account_id: int):
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM accounts WHERE id = ?", (account_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None
    finally:
        await db.close()


async def create_account(phone: str, api_id: str, api_hash: str, session_name: str, reply_message: str = ""):
    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO accounts (phone, api_id, api_hash, session_name, reply_message) VALUES (?, ?, ?, ?, ?)",
            (phone, api_id, api_hash, session_name, reply_message),
        )
        await db.commit()
        cursor = await db.execute("SELECT last_insert_rowid()")
        row = await cursor.fetchone()
        return row[0]
    finally:
        await db.close()


async def update_account(account_id: int, **kwargs):
    db = await get_db()
    try:
        fields = ", ".join(f"{k} = ?" for k in kwargs)
        values = list(kwargs.values()) + [account_id]
        await db.execute(f"UPDATE accounts SET {fields} WHERE id = ?", values)
        await db.commit()
    finally:
        await db.close()


async def delete_account(account_id: int):
    db = await get_db()
    try:
        await db.execute("DELETE FROM groups WHERE account_id = ?", (account_id,))
        await db.execute("DELETE FROM accounts WHERE id = ?", (account_id,))
        await db.commit()
    finally:
        await db.close()


# ─── 群组 CRUD ─────────────────────────────────────────────

async def get_groups(account_id: int = None):
    db = await get_db()
    try:
        if account_id:
            cursor = await db.execute(
                "SELECT g.*, a.phone as account_phone, mt.name as template_name "
                "FROM groups g "
                "LEFT JOIN accounts a ON g.account_id = a.id "
                "LEFT JOIN message_templates mt ON g.message_template_id = mt.id "
                "WHERE g.account_id = ? ORDER BY g.id",
                (account_id,),
            )
        else:
            cursor = await db.execute(
                "SELECT g.*, a.phone as account_phone, mt.name as template_name "
                "FROM groups g "
                "LEFT JOIN accounts a ON g.account_id = a.id "
                "LEFT JOIN message_templates mt ON g.message_template_id = mt.id "
                "ORDER BY g.id"
            )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


async def sync_groups(account_id: int, groups_data: list):
    """同步账号的群组列表"""
    db = await get_db()
    try:
        for g in groups_data:
            await db.execute(
                "INSERT OR IGNORE INTO groups (account_id, group_id, title, username) VALUES (?, ?, ?, ?)",
                (account_id, str(g["id"]), g.get("title", ""), g.get("username", "")),
            )
            # 更新群名（可能会变）
            await db.execute(
                "UPDATE groups SET title = ?, username = ? WHERE account_id = ? AND group_id = ?",
                (g.get("title", ""), g.get("username", ""), account_id, str(g["id"])),
            )
        await db.commit()
    finally:
        await db.close()


async def update_group(group_id: int, **kwargs):
    db = await get_db()
    try:
        fields = ", ".join(f"{k} = ?" for k in kwargs)
        values = list(kwargs.values()) + [group_id]
        await db.execute(f"UPDATE groups SET {fields} WHERE id = ?", values)
        await db.commit()
    finally:
        await db.close()


async def get_enabled_groups(account_id: int):
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT g.*, mt.content as template_content, mt.forward_url as template_forward_url "
            "FROM groups g "
            "LEFT JOIN message_templates mt ON g.message_template_id = mt.id "
            "WHERE g.account_id = ? AND g.enabled = 1 ORDER BY g.id",
            (account_id,),
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


# ─── 消息模板 CRUD ─────────────────────────────────────────

async def get_templates():
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM message_templates ORDER BY id")
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


async def create_template(name: str, content: str, forward_url: str = ""):
    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO message_templates (name, content, forward_url) VALUES (?, ?, ?)",
            (name, content, forward_url),
        )
        await db.commit()
        cursor = await db.execute("SELECT last_insert_rowid()")
        row = await cursor.fetchone()
        return row[0]
    finally:
        await db.close()


async def update_template(template_id: int, **kwargs):
    db = await get_db()
    try:
        fields = ", ".join(f"{k} = ?" for k in kwargs)
        values = list(kwargs.values()) + [template_id]
        await db.execute(f"UPDATE message_templates SET {fields} WHERE id = ?", values)
        await db.commit()
    finally:
        await db.close()


async def delete_template(template_id: int):
    db = await get_db()
    try:
        await db.execute("UPDATE groups SET message_template_id = NULL WHERE message_template_id = ?", (template_id,))
        await db.execute("DELETE FROM message_templates WHERE id = ?", (template_id,))
        await db.commit()
    finally:
        await db.close()


# ─── 日志 ──────────────────────────────────────────────────

async def add_log(account_id: int, group_id: str, group_title: str, status: str, message: str = "", error: str = ""):
    db = await get_db()
    try:
        await db.execute(
            "INSERT INTO logs (account_id, group_id, group_title, status, message, error) VALUES (?, ?, ?, ?, ?, ?)",
            (account_id, group_id, group_title, status, message, error),
        )
        await db.commit()
    finally:
        await db.close()


async def get_logs(limit: int = 100, status: str = None, account_id: int = None):
    db = await get_db()
    try:
        query = (
            "SELECT l.*, a.phone as account_phone FROM logs l "
            "LEFT JOIN accounts a ON l.account_id = a.id WHERE 1=1"
        )
        params: list = []
        if status:
            query += " AND l.status = ?"
            params.append(status)
        if account_id:
            query += " AND l.account_id = ?"
            params.append(account_id)
        query += " ORDER BY l.id DESC LIMIT ?"
        params.append(limit)
        cursor = await db.execute(query, params)
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
    finally:
        await db.close()


# ─── 设置 ──────────────────────────────────────────────────

async def get_settings():
    db = await get_db()
    try:
        cursor = await db.execute("SELECT * FROM settings")
        rows = await cursor.fetchall()
        return {r["key"]: r["value"] for r in rows}
    finally:
        await db.close()


async def update_settings(settings: dict):
    db = await get_db()
    try:
        for key, value in settings.items():
            await db.execute(
                "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
                (key, str(value)),
            )
        await db.commit()
    finally:
        await db.close()


# ─── 统计 ──────────────────────────────────────────────────

async def get_stats():
    db = await get_db()
    try:
        today = datetime.now().strftime("%Y-%m-%d")
        accounts_cursor = await db.execute("SELECT COUNT(*) FROM accounts")
        accounts_count = (await accounts_cursor.fetchone())[0]

        running_cursor = await db.execute("SELECT COUNT(*) FROM accounts WHERE status = 'running'")
        running_count = (await running_cursor.fetchone())[0]

        groups_cursor = await db.execute("SELECT COUNT(*) FROM groups WHERE enabled = 1")
        groups_count = (await groups_cursor.fetchone())[0]

        today_success = await db.execute(
            "SELECT COUNT(*) FROM logs WHERE status = 'success' AND created_at LIKE ?", (f"{today}%",)
        )
        success_count = (await today_success.fetchone())[0]

        today_fail = await db.execute(
            "SELECT COUNT(*) FROM logs WHERE status = 'failed' AND created_at LIKE ?", (f"{today}%",)
        )
        fail_count = (await today_fail.fetchone())[0]

        total_today = success_count + fail_count
        success_rate = round(success_count / total_today * 100, 1) if total_today > 0 else 100.0

        return {
            "accounts_total": accounts_count,
            "accounts_running": running_count,
            "groups_enabled": groups_count,
            "today_success": success_count,
            "today_failed": fail_count,
            "success_rate": success_rate,
        }
    finally:
        await db.close()
