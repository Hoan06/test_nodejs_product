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

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || '123456';

// --- API Đăng nhập Admin ---
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    res.json({ success: true, token: 'admin-auth-token-secret' });
  } else {
    res.status(401).json({ success: false, error: 'Sai tài khoản hoặc mật khẩu!' });
  }
});

// --- API Gửi đánh giá (Công khai) ---
app.post('/api/reviews', (req, res) => {
  const { customer_name, rating, comment } = req.body;
  const rateValue = parseInt(rating);
  
  if (!customer_name || isNaN(rateValue) || rateValue < 1 || rateValue > 5) {
    return res.status(400).json({ error: 'Vui lòng nhập tên và chọn mức độ đánh giá hợp lệ (1-5)' });
  }

  const sql = 'INSERT INTO reviews (customer_name, is_satisfied, comment) VALUES (?, ?, ?)';
  // Lưu ý: Vẫn giữ tên cột is_satisfied trong DB hoặc đổi thành rating tuỳ bạn, ở đây ta lưu giá trị từ 1-5 vào cột đó
  pool.query(sql, [customer_name, rateValue, comment || ''], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Cảm ơn bạn đã đánh giá sản phẩm!', id: result.insertId });
  });
});

// --- API Thống kê (Dành cho Admin) ---
app.get('/api/stats', (req, res) => {
  pool.query('SELECT * FROM reviews ORDER BY id DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const total = rows.length;
    // Thống kê theo 5 mức độ (1 đến 5)
    const count1 = rows.filter(r => r.is_satisfied === 1).length;
    const count2 = rows.filter(r => r.is_satisfied === 2).length;
    const count3 = rows.filter(r => r.is_satisfied === 3).length;
    const count4 = rows.filter(r => r.is_satisfied === 4).length;
    const count5 = rows.filter(r => r.is_satisfied === 5).length;

    // Tính điểm trung bình (trên thang điểm 5)
    const totalScore = rows.reduce((sum, r) => sum + (r.is_satisfied || 0), 0);
    const avgScore = total > 0 ? (totalScore / total).toFixed(1) : 0;
    
    // Tỷ lệ tích cực (mức 4 và 5 được tính là hài lòng)
    const positiveCount = count4 + count5;
    const satisfactionRate = total > 0 ? Math.round((positiveCount / total) * 100) : 0;

    res.json({
      total,
      avgScore,
      satisfactionRate,
      breakdown: { count1, count2, count3, count4, count5 },
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