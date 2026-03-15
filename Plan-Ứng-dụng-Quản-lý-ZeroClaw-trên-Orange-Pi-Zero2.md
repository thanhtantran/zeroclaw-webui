# Plan: Ứng dụng Quản lý ZeroClaw trên Orange Pi Zero2

## 1. Tổng quan kiến trúc

Ứng dụng gồm 2 phần chính:

**Backend** — Node.js (Express) chạy trực tiếp trên Orange Pi Zero2, thực thi lệnh shell và đọc/ghi file cấu hình.

**Frontend** — Giao diện web đơn trang (SPA), responsive cho mobile, giao tiếp với backend qua REST API. Có thể dùng React hoặc vanilla HTML + Tailwind CSS để nhẹ nhất có thể trên thiết bị nhúng.

---

## 2. Phân tích tính năng & API Design

### Module 1: Quản lý cấu hình (`/api/config`)

| Endpoint | Phương thức | Mô tả |
|---|---|---|
| `/api/config` | GET | Đọc nội dung `config.toml` |
| `/api/config` | PUT | Ghi lại nội dung `config.toml` (kèm backup tự động) |
| `/api/config/backup` | GET | Liệt kê các bản backup |
| `/api/config/restore/:id` | POST | Phục hồi từ bản backup |

**Lưu ý quan trọng:** Trước mỗi lần ghi, tạo bản backup tự động tại `~/.zeroclaw/config.toml.bak.<timestamp>` để phòng sự cố.

### Module 2: Trạng thái & Service (`/api/service`)

| Endpoint | Phương thức | Lệnh thực thi |
|---|---|---|
| `/api/service/status` | GET | `zeroclaw status` |
| `/api/service/service-status` | GET | `zeroclaw service status` |
| `/api/service/restart` | POST | `zeroclaw service restart` |

### Module 3: Chẩn đoán (`/api/diagnostics`)

| Endpoint | Phương thức | Lệnh/Nguồn |
|---|---|---|
| `/api/diagnostics/doctor` | GET | `zeroclaw doctor` |
| `/api/diagnostics/channel` | GET | `zeroclaw channel doctor` |
| `/api/diagnostics/daemon` | GET | Đọc file `daemon_state.json` |

### Module 4: Cập nhật (`/api/update`)

| Endpoint | Phương thức | Mô tả |
|---|---|---|
| `/api/update/check` | GET | `cd /home/admin/zeroclaw && git fetch && git log HEAD..origin/main --oneline` |
| `/api/update/pull` | POST | `cd /home/admin/zeroclaw && git pull` |
| `/api/update/build` | POST | Chạy `/home/admin/zeroclaw/install.sh --prefer-prebuilt` |
| `/api/update/status` | GET | Trả về trạng thái build hiện tại (đang chạy / hoàn thành / lỗi) |

**Lưu ý:** Build có thể mất vài phút → dùng **Server-Sent Events (SSE)** hoặc **WebSocket** để stream log realtime về frontend.

### Module 5: Quản lý Skill (`/api/skills`)

| Endpoint | Phương thức | Mô tả |
|---|---|---|
| `/api/skills/installed` | GET | `zeroclaw skills list` |
| `/api/skills/available` | GET | Liệt kê thư mục trong `/home/admin/open-skills/` |
| `/api/skills/install` | POST | `zeroclaw skills install /home/admin/open-skills/<tên-skill>/` |

---

## 3. Stack công nghệ đề xuất

| Thành phần | Lựa chọn | Lý do |
|---|---|---|
| Runtime | Node.js 18+ (LTS) | Yêu cầu của bạn, hỗ trợ tốt trên ARM64 |
| Backend framework | **Express.js** | Nhẹ, đơn giản, phù hợp thiết bị nhúng |
| Frontend | **React + Vite** (build static) hoặc **Vanilla + Tailwind** | Tùy mức phức tạp mong muốn |
| CSS | **Tailwind CSS** | Responsive nhanh, mobile-first |
| Realtime | **SSE** (Server-Sent Events) | Nhẹ hơn WebSocket, đủ cho stream log 1 chiều |
| TOML parser | `@iarna/toml` hoặc `smol-toml` | Đọc/ghi config.toml |
| Shell execution | `child_process.exec` / `spawn` | Chạy lệnh hệ thống |
| Auth (tùy chọn) | Token đơn giản hoặc Basic Auth | Bảo vệ API trên mạng LAN |

---

## 4. Cấu trúc dự án

```
zeroclaw-manager/
├── server/
│   ├── index.js              # Entry point Express
│   ├── routes/
│   │   ├── config.js         # API quản lý config.toml
│   │   ├── service.js        # API trạng thái & restart
│   │   ├── diagnostics.js    # API chẩn đoán
│   │   ├── update.js         # API cập nhật & build
│   │   └── skills.js         # API quản lý skill
│   ├── utils/
│   │   ├── shell.js          # Helper chạy lệnh shell an toàn
│   │   └── backup.js         # Helper backup/restore config
│   └── middleware/
│       └── auth.js           # Xác thực đơn giản (tùy chọn)
├── client/                   # Frontend (React hoặc vanilla)
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Config.jsx
│   │   │   ├── Diagnostics.jsx
│   │   │   ├── Update.jsx
│   │   │   └── Skills.jsx
│   │   └── components/
│   │       ├── Terminal.jsx   # Hiển thị output dạng terminal
│   │       ├── StatusBadge.jsx
│   │       └── NavBar.jsx
│   └── dist/                 # Build tĩnh, Express serve trực tiếp
├── package.json
└── ecosystem.config.js       # PM2 config (chạy như service)
```

---

## 5. Giao diện (UI Wireframe)

Giao diện mobile-first gồm **5 tab chính** dưới thanh navigation:

```
┌─────────────────────────────┐
│  🔧 ZeroClaw Manager       │
├─────────────────────────────┤
│                             │
│  ● ZeroClaw: Running ✅     │
│  ● Service:  Active  ✅     │
│  ● Uptime:   2d 5h 31m     │
│                             │
│  [Restart Service]          │
│                             │
├─────────────────────────────┤
│ 🏠  ⚙️  🩺  🔄  🧩        │
│ Home Config Diag Update Skill│
└─────────────────────────────┘
```

---

## 6. Kế hoạch thực hiện (theo thứ tự)

### Bước 1 — Khởi tạo dự án & backend cơ bản
- `npm init`, cài Express, `@iarna/toml`, `cors`
- Viết `shell.js` helper (wrapper cho `child_process` với timeout, sanitize)
- Tạo route `/api/service/status` làm POC (chứng minh khái niệm)

### Bước 2 — Hoàn thiện tất cả API routes
- Lần lượt triển khai 5 module API
- Viết backup logic cho config
- Thêm SSE endpoint cho build log

### Bước 3 — Frontend
- Khởi tạo React + Vite + Tailwind
- Xây 5 trang theo tab navigation
- Component `Terminal` để hiển thị output lệnh
- Component `ConfigEditor` với syntax highlighting cho TOML (dùng `CodeMirror` hoặc `Monaco Editor` phiên bản nhẹ)

### Bước 4 — Tích hợp & kiểm thử
- Kết nối frontend ↔ backend
- Test trên Orange Pi thực tế
- Xử lý edge case: lệnh timeout, file không tồn tại, quyền truy cập

### Bước 5 — Triển khai như service
- Dùng **PM2** để chạy app như daemon
- Tạo script `systemd` service (tùy chọn)
- Cấu hình khởi động cùng hệ thống

---

## 7. Các điểm cần lưu ý

**Bảo mật:**
- App chạy lệnh shell → **rất cần** sanitize input, không cho phép injection
- Nên có ít nhất Basic Auth hoặc token cố định (biến môi trường)
- Chỉ bind vào mạng LAN (`0.0.0.0` có rủi ro nếu có port forwarding)

**Hiệu năng trên Orange Pi Zero2:**
- RAM chỉ ~1GB → giữ app nhẹ, tránh build frontend trên thiết bị (build trên máy tính rồi copy `dist/` lên)
- Dùng `spawn` thay `exec` cho lệnh dài (stream output, không buffer toàn bộ)

**Xử lý lệnh dài (build):**
- Build có thể mất 3-10 phút → cần cơ chế: chỉ cho phép 1 build cùng lúc, stream log realtime qua SSE, trả về trạng thái khi refresh trang

---

## 8. Bước tiếp theo

Để bắt đầu triển khai, tôi cần thêm thông tin:

1. **Nội dung file `config.toml`** — bạn đã đề cập sẽ cung cấp sau, tôi cần để thiết kế form chỉnh sửa có hướng dẫn chi tiết cho từng trường
2. **Output mẫu** của các lệnh `zeroclaw status`, `zeroclaw doctor`, `zeroclaw skills list` — để thiết kế giao diện hiển thị phù hợp (parse thành bảng hay hiển thị raw)
3. **Nội dung mẫu `daemon_state.json`** — để biết cấu trúc dữ liệu và hiển thị trực quan

Khi có những thông tin trên, tôi có thể bắt tay vào code ngay. Bạn muốn tôi bắt đầu từ phần nào trước?