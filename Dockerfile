# ─── 阶段 1: 构建前端 ──────────────────────────────────
FROM node:20-slim AS frontend-builder
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ─── 阶段 2: 运行后端 ──────────────────────────────────
FROM python:3.11-slim
WORKDIR /app

# 安装后端依赖
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# 复制后端代码
COPY backend/ ./backend/

# 复制前端打包产物
COPY --from=frontend-builder /build/dist ./frontend/dist/

# 创建数据目录
RUN mkdir -p /app/data/sessions

# 环境变量
ENV DB_PATH=/app/data/tgbot.db
ENV PYTHONUNBUFFERED=1
ENV TZ=Asia/Shanghai

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
