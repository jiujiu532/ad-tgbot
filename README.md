# TG 广告 Bot

基于 ads-tgbot 改造的 Telegram 群发广告管理系统。
Web 管理界面 + 定向群组 + Docker 一键部署。

## 快速部署

```bash
docker-compose build && docker-compose up -d
```

访问 http://你的IP:8000

## 本地开发

后端:
```bash
cd backend && pip install -r requirements.txt
python -m uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

前端:
```bash
cd frontend && npm install && npm run dev
```

## 技术栈

- 后端: FastAPI + Telethon + SQLite
- 前端: React + Ant Design + Vite
- 部署: Docker + docker-compose
