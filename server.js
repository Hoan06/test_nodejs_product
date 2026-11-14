require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Kết nối MySQL Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  waitForConnections: true,
  connectionLimit: 10
});

// Tự động tạo bảng reviews nếu chưa có
// pool.query(`
//   CREATE TABLE IF NOT EXISTS reviews (
//     id INT AUTO_INCREMENT PRIMARY KEY,
//     customer_name VARCHAR(100) NOT NULL,
//     is_satisfied TINYINT(1) NOT NULL,
//     comment TEXT,
//     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
//   )
// `, (err) => {
//   if (err) console.error('Lỗi khởi tạo bảng:', err);
// });

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || '123456';

// --- API Đăng nhập Admin ---
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    // Trả về một token đơn giản (hoặc cờ xác nhận thành công)
    res.json({ success: true, token: 'admin-auth-token-secret' });
  } else {
    res.status(401).json({ success: false, error: 'Sai tài khoản hoặc mật khẩu!' });
  }
});

// --- API Gửi đánh giá (Công khai) ---
app.post('/api/reviews', (req, res) => {
  const { customer_name, is_satisfied, comment } = req.body;
  if (!customer_name || is_satisfied === undefined) {
    return res.status(400).json({ error: 'Vui lòng nhập tên và chọn mức độ hài lòng' });
  }

  const sql = 'INSERT INTO reviews (customer_name, is_satisfied, comment) VALUES (?, ?, ?)';
  pool.query(sql, [customer_name, is_satisfied ? 1 : 0, comment || ''], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Cảm ơn bạn đã đánh giá!', id: result.insertId });
  });
});

// --- API Thống kê (Dành cho Admin) ---
app.get('/api/stats', (req, res) => {
  // Có thể check header Authorization nếu muốn bảo mật sâu hơn
  pool.query('SELECT * FROM reviews ORDER BY id DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const total = rows.length;
    const satisfiedCount = rows.filter(r => r.is_satisfied === 1).length;
    const unsatisfiedCount = total - satisfiedCount;
    const satisfactionRate = total > 0 ? Math.round((satisfiedCount / total) * 100) : 0;

    res.json({
      total,
      satisfiedCount,
      unsatisfiedCount,
      satisfactionRate,
      reviews: rows
    });
  });
});

// Route trang Admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(3000, () => console.log('Server chạy tại: http://localhost:3000'));
}

module.exports = app;