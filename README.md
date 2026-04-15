# ZeroClaw WebUI

Web app (responsive, ưu tiên desktop-first) để quản lý ZeroClaw chạy trên Orange Pi Zero2/Zero3: xem trạng thái, chạy doctor, điều khiển service, pull+build, chỉnh `config.toml`, và quản lý skills (open-skills) và còn nhiều chức năng nữa

**Hướng dẫn cài đặt ZeroClaw trên Orange Pi Zero2**
[![Hướng dẫn cài đặt ZeroClaw trên Orange Pi Zero2](https://img.youtube.com/vi/kzjKOWg-lQA/0.jpg)]([https://www.youtube.com](https://www.youtube.com/watch?v=kzjKOWg-lQA))

## Yêu cầu cấu hình

### Thiết bị/OS (Orange Pi Zero2 hoặc Orange Pi Zero3)
- Linux (khuyến nghị Debian/Ubuntu base).
- Có user `admin` và các đường dẫn đúng như bên dưới.
- ZeroClaw CLI cài sẵn và chạy được trong PATH:
  - `zeroclaw status`
  - `zeroclaw doctor`
  - `zeroclaw channel doctor`
  - `zeroclaw service status|start|stop|restart`
  - `zeroclaw skills list`
- Repo ZeroClaw và open-skills tồn tại:
  - Repo ZeroClaw: `/home/admin/zeroclaw`
  - Open skills: `/home/admin/open-skills/skills/**/SKILL.md`


# Hướng dẫn Deploy ZeroClaw WebUI

Hướng dẫn triển khai ứng dụng ZeroClaw Manager (client + server) lên môi trường production, đặc biệt trên Orange Pi Zero2.

---

## 1. Yêu cầu hệ thống

| Thành phần | Yêu cầu |
|------------|---------|
| Node.js | >= 18.0.0 (LTS khuyến nghị) |
| npm | >= 9.x |
| Hệ điều hành | Linux (Orange Pi, Raspberry Pi, Ubuntu, v.v.) |

---

## 2. Deploy Client (Frontend)

Client là ứng dụng React + Vite + Tailwind CSS. **Khuyến nghị build trên máy tính** (không build trên Orange Pi vì RAM hạn chế ~1GB).

### 2.1. Cài đặt dependencies

```bash
cd client
npm install
```

### 2.2. Build production

```bash
npm run build
```

Output sẽ nằm trong thư mục `client/dist/`.

### 2.3. Copy bản build lên server

Sau khi build xong, copy toàn bộ thư mục `dist/` lên máy chạy server:

```bash
# Ví dụ dùng scp (từ máy build)
scp -r client/dist/* user@orange-pi:/path/to/zeroclaw-webui/client/dist/
```

Hoặc nếu build trực tiếp trên máy server:

```bash
cd client
npm install --omit=dev   # Chỉ cài production deps (nhẹ hơn)
npm run build
```

---

## 3. Deploy Server (Backend)

Server là ứng dụng Node.js (Express) cung cấp REST API và WebSocket.

### 3.1. Cài đặt dependencies

```bash
# Ở thư mục gốc dự án
npm install
```

### 3.2. Cấu hình môi trường (tùy chọn)

Tạo file `.env` hoặc export biến môi trường:

| Biến | Mô tả | Mặc định |
|------|-------|----------|
| `PORT` | Cổng server lắng nghe | `3000` |
| `ZEROCLAW_REPO_DIR` | Đường dẫn repo zeroclaw | `/home/admin/zeroclaw` |
| `ZEROCLAW_INSTALL_SCRIPT` | Đường dẫn script install | `{REPO_DIR}/install.sh` |

Ví dụ:

```bash
export PORT=3000
export ZEROCLAW_REPO_DIR=/home/admin/zeroclaw
```

### 3.3. Cấu hình serve static (Client)

Để server phục vụ luôn giao diện web đã build, thêm vào `server/index.js` **sau** `app.use('/api', routes)` và **trước** `server.listen()`:

```javascript
// Serve static files từ client/dist (production)
const distPath = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(distPath));

// Fallback cho SPA: route không match file tĩnh → trả về index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});
```

### 3.4. Chạy server thủ công

```bash
npm start
```

Server sẽ chạy tại `http://localhost:3000` (hoặc cổng đã cấu hình).

### 3.5. Chạy bằng PM2 (production)

PM2 giúp chạy ứng dụng như daemon, tự khởi động lại khi crash, khởi động cùng hệ thống.

**Cài PM2:**

```bash
npm install -g pm2
```

**Tạo file `ecosystem.config.js`** (ở thư mục gốc):

```javascript
module.exports = {
  apps: [{
    name: 'zeroclaw-manager',
    script: 'server/index.js',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_file: '.env'
  }]
};
```

**Chạy với PM2:**

```bash
pm2 start ecosystem.config.js
```

**Các lệnh hữu ích:**

```bash
pm2 status              # Xem trạng thái
pm2 logs zeroclaw-manager   # Xem log
pm2 restart zeroclaw-manager # Khởi động lại
pm2 stop zeroclaw-manager    # Dừng
pm2 delete zeroclaw-manager  # Xóa khỏi PM2
```

**Khởi động cùng hệ thống:**

```bash
pm2 startup
pm2 save
```

---

## 4. Quy trình Deploy đầy đủ

### Bước 1: Build client (trên máy dev)

```bash
cd client
npm install
npm run build
```

### Bước 2: Đồng bộ code lên server

```bash
# Dùng rsync hoặc scp
rsync -avz --exclude node_modules --exclude .git . user@orange-pi:/home/admin/zeroclaw-webui/
```

### Bước 3: Cài đặt và chạy server (trên Orange Pi)

```bash
cd /home/admin/zeroclaw-webui
npm install --omit=dev
npm start
# Hoặc: pm2 start ecosystem.config.js
```

### Bước 4: Kiểm tra

- Mở trình duyệt: `http://<ip-orange-pi>:3000`
- Health check: `http://<ip-orange-pi>:3000/health`
- API: `http://<ip-orange-pi>:3000/api`

---

## 5. Deploy riêng Client và Server (reverse proxy)

Nếu muốn chạy client và server trên các cổng/domain khác nhau, dùng **Nginx** làm reverse proxy.

### 5.1. Cấu hình Nginx mẫu

```nginx
server {
    listen 80;
    server_name zeroclaw.local;

    # Client (static)
    location / {
        root /home/admin/zeroclaw-webui/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # API & WebSocket
    location /api {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

**Lưu ý:** Cần cấu hình WebSocket path trong server nếu dùng `/ws`. Hiện tại WebSocket build log có thể dùng path khác — kiểm tra `updateSocket.js`.

### 5.2. Chỉnh Client gọi API qua proxy

Nếu client và server khác domain/cổng, cần cấu hình base URL cho API (ví dụ dùng biến `VITE_API_URL` trong client).

---

## 6. Bảo mật (khuyến nghị)

- **Chỉ bind LAN:** Tránh expose ra internet nếu không cần.
- **Basic Auth / Token:** Cân nhắc thêm middleware xác thực cho API.
- **HTTPS:** Dùng Let's Encrypt + Nginx nếu truy cập qua mạng.

---

## 7. Xử lý sự cố

| Vấn đề | Gợi ý |
|--------|-------|
| `EACCES` khi chạy lệnh zeroclaw | Chạy server bằng user có quyền (ví dụ `admin`) |
| Client không kết nối API | Kiểm tra CORS, URL base, firewall |
| Build timeout | Tăng timeout trong `shell.js`, kiểm tra kết nối mạng |
| PM2 không khởi động cùng OS | Chạy lại `pm2 startup` và `pm2 save` |

---

## 8. Tóm tắt lệnh nhanh

```bash
# Build client
cd client && npm install && npm run build

# Chạy server (dev)
npm start

# Chạy server (production với PM2)
pm2 start ecosystem.config.js
```
