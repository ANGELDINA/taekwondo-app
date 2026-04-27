require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const session = require('express-session');

const app = express();

// ================= MIDDLEWARE =================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
  secret: 'secret123',
  resave: false,
  saveUninitialized: false
}));

// ================= DATABASE =================
const db = mysql.createConnection({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT
});
db.connect((err) => {
  if (err) {
    console.log("❌ DB ERROR:", err);
  } else {
    console.log("✅ MySQL Connected");
  }
});

// ================= REGISTER =================
app.post('/register', async (req, res) => {
  const { nama, email, password } = req.body;

  if (!nama || !email || !password) {
    return res.json({ message: 'Data tidak lengkap ❌' });
  }

  const hashed = await bcrypt.hash(password, 10);

  db.query(
    'INSERT INTO users (nama, email, password) VALUES (?, ?, ?)',
    [nama, email, hashed],
    (err) => {
      if (err) return res.json({ message: 'Email sudah digunakan ❌' });
      res.json({ message: 'Registrasi berhasil ✅' });
    }
  );
});

// ================= LOGIN =================
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  db.query('SELECT * FROM users WHERE email=?', [email], async (err, result) => {

    if (err) return res.json({ message: 'DB Error ❌' });

    if (result.length === 0) {
      return res.json({ message: 'Email tidak ditemukan ❌' });
    }

    const user = result[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.json({ message: 'Password salah ❌' });
    }

    req.session.user = user;

    req.session.save(() => {
      res.json({ message: 'Login berhasil ✅' });
    });
  });
});

// ================= DASHBOARD =================
app.get('/dashboard', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login.html');
  }

  res.sendFile(__dirname + '/public/dashboard.html');
});

// TAMBAH DOJANG
app.post('/tambah-dojang', (req, res) => {
  if (!req.session.user) {
    return res.json({ message: 'Harus login ❌' });
  }

  const { nama_dojang, manager, official, coach } = req.body;

  db.query(
    `INSERT INTO dojang (user_id, nama_dojang, manager, official, coach)
     VALUES (?, ?, ?, ?, ?)`,
    [req.session.user.id, nama_dojang, manager, official, coach],
    (err) => {
      if (err) {
        console.log(err);
        return res.json({ message: 'Gagal simpan dojang ❌' });
      }

      res.json({ message: 'Dojang berhasil disimpan ✅' });
    }
  );
});

// ================= TAMBAH ATLET =================
app.post('/tambah-atlet', (req, res) => {
  if (!req.session.user) {
    return res.json({ message: 'Harus login ❌' });
  }

  const d = req.body;

  // 🔥 AMBIL DOJANG ID DULU
  db.query(
    'SELECT id FROM dojang WHERE user_id = ?',
    [req.session.user.id],
    (err, dojangResult) => {
      if (err || dojangResult.length === 0) {
        console.log(err);
        return res.json({ message: 'Dojang belum dibuat ❌' });
      }

      const dojang_id = dojangResult[0].id;

      // 🔥 BARU INSERT ATLET
      db.query(
        `INSERT INTO atlet 
        (dojang_id, nik, nama_lengkap, tempat_lahir, tanggal_lahir, tinggi, berat, jenis_kelamin, kategori, jenis_tanding, sub_kategori, kelas, provinsi, kabupaten, kecamatan, no_hp, pendidikan, gol_darah, email, no_hp_ortu)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          dojang_id,
          d.nik,
          d.nama_lengkap,
          d.tempat_lahir,
          d.tanggal_lahir,
          d.tinggi,
          d.berat,
          d.jenis_kelamin,
          d.kategori,
          d.jenis_tanding,
          d.sub_kategori,
          d.kelas,
          d.provinsi,
          d.kabupaten,
          d.kecamatan,
          d.no_hp,
          d.pendidikan,
          d.gol_darah,
          d.email,
          d.no_hp_ortu
        ],
        (err2) => {
          if (err2) {
            console.log(err2);
            return res.json({ message: 'Gagal simpan ❌' });
          }

          res.json({ message: 'Atlet berhasil disimpan ✅' });
        }
      );
    }
  );
});

// list atlet
app.get('/list-atlet', (req, res) => {
  if (!req.session.user) {
    return res.json([]);
  }

  db.query(`
    SELECT 
      d.nama_dojang,
      a.nama_lengkap,
      a.nik,
      DATE_FORMAT(a.tanggal_lahir, '%d/%m/%Y') as tanggal_lahir,
      a.kategori,
      a.jenis_tanding,
      a.sub_kategori,
      a.kelas,
      a.provinsi,
      a.kabupaten
    FROM atlet a
    JOIN dojang d ON a.dojang_id = d.id
    WHERE d.user_id = ?
  `, [req.session.user.id], (err, result) => {
    if (err) {
      console.log(err);
      return res.json([]);
    }
    res.json(result);
  });
});

// GET DATA ATLET
app.get('/data-atlet', (req, res) => {
  if (!req.session.user) {
    return res.json([]);
  }

  db.query(
    `SELECT 
      atlet.nama_lengkap,
      atlet.nik,
      DATE_FORMAT(atlet.tanggal_lahir, '%d/%m/%Y') AS tanggal_lahir,
      atlet.kategori,
      atlet.jenis_tanding,
      atlet.sub_kategori,
      atlet.jenis_kelamin,
      atlet.kelas,
      atlet.provinsi,
      atlet.kabupaten,
      dojang.nama_dojang
    FROM atlet
    JOIN dojang ON atlet.dojang_id = dojang.id
    WHERE dojang.user_id = ?`,
    [req.session.user.id],
    (err, result) => {
      if (err) {
        console.log(err);
        return res.json([]);
      }

      res.json(result);
    }
  );
});

// ================= LOGOUT =================
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login.html');
  });
});

// ================= DATABASE CONNECT =================
db.connect((err) => {
  if (err) {
    console.log("❌ DB ERROR:", err);
  } else {
    console.log("✅ MySQL Connected");
  }
});

// ================= SERVER =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('🚀 Server jalan di port:', PORT);
});