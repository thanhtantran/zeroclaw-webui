# Báo cáo kiểm tra code - ZeroClaw WebUI

**Ngày kiểm tra:** 16/03/2025  
**Phạm vi:** Client (React + Vite) và Server (Express + WebSocket)

---

## 1. Vấn đề nghiêm trọng (Critical)

### 1.1 Thiếu proxy API khi chạy dev (Client)

**File:** `client/vite.config.js`

**Mô tả:** Client gọi `fetch('/api/...')` với URL tương đối. Trong môi trường dev:
- Vite chạy trên port 5173
- Server chạy trên port 3000
- Request `/api/*` sẽ gửi tới `http://localhost:5173/api` → **404** vì Vite không có route này

**Khắc phục:** Thêm proxy trong `vite.config.js`:

```js
server: {
  port: 5173,
  proxy: {
    '/api': 'http://localhost:3000',
    '/ws': 'http://localhost:3000',
    '/health': 'http://localhost:3000',
  },
},
```

---

### 1.2 Server không serve static client build (Production)

**File:** `server/index.js`

**Mô tả:** Server chỉ expose API và WebSocket. Không có cấu hình serve file tĩnh cho client build. Khi deploy production, cần:
- Build client: `cd client && npm run build`
- Serve thư mục `client/dist` qua Express

**Khắc phục:** Thêm vào `server/index.js` (sau các route API):

```js
const clientDist = path.join(__dirname, '../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});
```

---

## 2. Vấn đề trung bình (Medium)

### 2.1 CORS cho phép mọi origin

**File:** `server/index.js`

**Mô tả:** `app.use(cors())` cho phép mọi origin gọi API. Trong môi trường production, nên giới hạn origin để tránh lạm dụng.

**Khắc phục:** Cấu hình CORS rõ ràng:

```js
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT'],
}));
```

---

### 2.2 Dashboard: daemonState không được cập nhật khi fetchAll lỗi

**File:** `client/src/pages/Dashboard.jsx`

**Mô tả:** Trong `fetchAll`, khi `statusRes` hoặc `svcRes` không ok (throw Error), block `catch` chỉ gọi `setStatusData` và `setServiceStatus`. `setDaemonState` không được gọi → `daemonState` có thể mắc kẹt ở `loading: true`.

**Khắc phục:** Trong block `catch`, thêm:

```js
setDaemonState((prev) => ({ ...prev, loading: false, error: err.message, data: null }));
```

---

### 2.3 Giới hạn kích thước body (config PUT)

**File:** `server/routes/config.js`

**Mô tả:** `express.text({ type: '*/*' })` dùng limit mặc định (~100kb). Config TOML lớn có thể bị từ chối.

**Khắc phục:** Tăng limit nếu cần:

```js
router.put('/', express.text({ type: '*/*', limit: '1mb' }), async (req, res) => {
```

---

### 2.4 Update build: thiếu xử lý khi install.sh không tồn tại

**File:** `server/routes/update.js`

**Mô tả:** `spawn(INSTALL_SCRIPT, ...)` có thể fail với ENOENT nếu `install.sh` không tồn tại. `child.on('error')` đã xử lý, nhưng `buildState` có thể không được reset đúng khi process chưa start.

**Ghi chú:** Logic hiện tại đã có `child.on('error')` gọi `setBuildStatus('failed', ...)`. Có thể cải thiện bằng cách kiểm tra file tồn tại trước khi spawn.

---

### 2.5 Skills install: path.normalize có thể khác trên Windows

**File:** `server/routes/skills.js`

**Mô tả:** Dự án target Orange Pi (Linux), nhưng nếu chạy trên Windows để dev/test, `path.normalize` và `path.join` có thể tạo path khác. `normalized.startsWith(path.normalize(OPEN_SKILLS_DIR))` có thể fail trên Windows với path kiểu `C:\...`.

**Ghi chú:** Chấp nhận được nếu chỉ chạy trên Linux. Nếu cần cross-platform, dùng `path.resolve` và so sánh `realpath`.

---

## 3. Vấn đề nhỏ (Minor)

### 3.1 Sử dụng index làm key trong list

**Files:** `client/src/pages/Diagnostics.jsx`, `client/src/pages/Skills.jsx`

**Mô tả:** `key={idx}` trong `.map()` không lý tưởng khi danh sách có thể thay đổi thứ tự. Với dữ liệu từ API tương đối tĩnh, ảnh hưởng thấp.

**Gợi ý:** Dùng `key={section}` hoặc `key={c.name}` khi có identifier ổn định.

---

### 3.2 Middleware chưa sử dụng

**File:** `server/middleware/index.js`

**Mô tả:** Thư mục middleware tồn tại nhưng chưa được mount trong `server/index.js`. Có thể dùng cho auth, logging, rate limit.

---

### 3.3 WebSocket: không log lỗi

**File:** `server/updateSocket.js`

**Mô tả:** `try/catch` trong broadcast bắt lỗi nhưng không log. Khó debug khi có vấn đề gửi message.

**Gợi ý:** Thêm `console.warn` hoặc logger khi catch.

---

### 3.4 Config Raw mode: không validate TOML trước khi gửi

**File:** `client/src/pages/Config.jsx`

**Mô tả:** Ở chế độ Raw, client gửi `rawText` trực tiếp mà không parse/validate TOML trước. Server vẫn validate và trả lỗi, nhưng UX có thể cải thiện bằng validate phía client trước khi save.

---

## 4. Điểm tốt (Good practices)

### 4.1 Bảo mật

- **Shell injection:** `server/utils/shell.js` có `sanitizeInput` chặn ký tự nguy hiểm (`;`, `|`, `&`, `` ` ``, `$()`, v.v.)
- **Path traversal:** `server/utils/backup.js` kiểm tra `path.isAbsolute`, `..`, và prefix backup
- **Skills install:** Validate tên skill `[a-zA-Z0-9_-]`, kiểm tra path nằm trong `OPEN_SKILLS_DIR`

### 4.2 Xử lý lỗi

- Các route API có try/catch và trả HTTP status phù hợp (400, 404, 500, 504)
- Client có xử lý `res.json().catch(() => null)` khi parse JSON lỗi

### 4.3 Cấu trúc code

- Tách routes rõ ràng (config, service, diagnostics, update, skills)
- Utils tách biệt (shell, backup)
- Có unit test cho `shell.js`

### 4.4 UX

- Confirm trước các thao tác quan trọng (restart, save config, restore, pull, build)
- Loading state và thông báo lỗi rõ ràng

---

## 5. Tổng kết

| Mức độ   | Số lượng | Hành động đề xuất                          |
|----------|----------|--------------------------------------------|
| Critical | 2        | Sửa ngay (proxy dev, static serve prod)     |
| Medium   | 4        | Nên sửa trong sprint gần nhất              |
| Minor    | 4        | Có thể xử lý khi refactor                  |

**Ưu tiên:** Khắc phục 2 vấn đề Critical trước để ứng dụng chạy đúng trong cả môi trường dev và production.
