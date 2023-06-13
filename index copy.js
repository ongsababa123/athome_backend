const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
const mysql = require('mysql');
const bodyParser = require('body-parser');
var jsonParser = bodyParser.json();
const cors = require('cors');
const secret = "Fullstack-login";
const util = require('util');
const { promisify } = require('util');
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));
// Enable CORS
app.use(cors());

// Parse JSON requests
app.use(bodyParser.json());

// Create MySQL connection
const connection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'athome'
});

// Connect to MySQL
connection.connect((err) => {
  if (err) throw err;
  console.log('Connected to MySQL');
});
const query = util.promisify(connection.query).bind(connection);

function checkDuplicateUsername(username, callback) {
  connection.query(
    "SELECT COUNT(*) AS count FROM user WHERE username = ?",
    [username],
    (err, result) => {
      if (err) {
        callback(err, null);
      } else {
        const count = result[0].count;
        callback(null, count > 0);
      }
    }
  );
}

// Login API
app.post('/login', async (req, res) => {
  const { user, password } = req.body;

  try {
    const userResults = await query('SELECT * FROM user WHERE username = ? AND password_user = ?', [user, password]);

    if (userResults.length > 0) {
      const id = userResults[0].id_user;
      const token = jwt.sign({ id: id , profile: "user" }, secret, { expiresIn: '12h' });
      return res.json({ status: "ok", token });
    }

    const adminResults = await query('SELECT * FROM admin WHERE name = ? AND password = ?', [user, password]);
    if (adminResults.length > 0) {
      const id = adminResults[0].id_admin;
      const token = jwt.sign({ id: id , profile: "admin" }, secret, { expiresIn: '12h' });
      return res.json({ status: "admin", token });
    }

    return res.json({ status: "not found" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/authen", jsonParser, function (req, res, next) {
  try {
    const token = req.headers.authorization.split(" ")[1];
    var decoded = jwt.verify(token, secret);
    res.json({ status: "ok", decoded });
  } catch (err) {
    res.json({ status: "error", message: err.message });
  }
});

app.get("/userdata", (req, res, next) => {
  connection.query('SELECT * FROM user ', (err, result) => {
    if (err) {
      console.log(err);
    } else {
      res.send(result);
    }
  });
  // db.end();
});

app.put("/update_employee", jsonParser, function (req, res, next) {
  const id = req.body.id;
  const name = req.body.name;
  const lastname = req.body.lastname;
  const username = req.body.username;
  const password = req.body.password;
  connection.query(
    "UPDATE user SET username = ?, name_user = ?, lastname_user = ?, password_user = ?  WHERE id_user = ?",
    [username, name, lastname, password, id],
    (err, result) => {
      try {
        res.json({ status: "ok", result });
      } catch (error) {
        console.log(err);
      }
    }
  );
});

app.post("/add_employee", jsonParser, function (req, res, next) {
  const username = req.body.username;

  checkDuplicateUsername(username, (err, isDuplicate) => {
    if (err) {
      console.log(err);
      res.json({ status: "error", message: "เกิดข้อผิดพลาดในการตรวจสอบชื่อผู้ใช้" });
    } else if (isDuplicate) {
      res.json({ status: "error", message: "ชื่อผู้ใช้ซ้ำกัน" });
    } else {
      connection.query(
        "INSERT INTO user (username, name_user, lastname_user, banking, phone, password_user) VALUES (?, ?, ?, ?, ?, ?)",
        [
        req.body.username,
        req.body.name,
        req.body.lastname,
        "",
        "",
        req.body.password,
        ],
        (err, result) => {
          if (err) {
            console.log(err);
            res.json({ status: "error", message: "เกิดข้อผิดพลาดในการเพิ่มข้อมูลผู้ใช้" });
          } else {
            res.json({ status: "ok", result });
          }
        }
      );
    }
  });
});


app.delete("/delete_employee", (req, res) => {
  const { ids } = req.body;
  console.log(ids);
  const query = `DELETE FROM user WHERE id_user IN (${ids.map(id => `'${id}'`).join(',')})`;
  connection.query(query, (err, result) => {
    try {
      res.json({ status: "ok", result });
    } catch (error) {
      console.log(err);
    }
  });
});

app.post('/api/save-image', (req, res) => {
  console.log(req.body);
  connection.query(
    "INSERT INTO images (encode_image, id_bill) VALUES (?, ?)",
    [
      req.body.image,
      1
    ],
    (err, result) => {
      try {
        res.json({ status: "ok", result });
      } catch (error) {
        console.log(err);
      }
    }
  );
});

app.post('/bill/drive', async (req, res) => {
  const { id_user, worktime, cash, transfer_amount, transfer_amount_user, expenses, note, images, commit_one, commit_two } = req.body;

  const today = new Date();
  const todayy = today.toISOString().slice(0, 10);
  try {
    const fullnameQuery = await promisify(connection.query).call(connection, "SELECT CONCAT(`name_user`, ' ', `lastname_user`) AS `fullname` FROM `user` WHERE `id_user` = ?", [id_user]);
    const fullname = fullnameQuery[0].fullname;

    const { insertId } = await promisify(connection.query).call(connection, "INSERT INTO bill (id_user, name_user, worktime, total_cash, total_transfer, total_transfer_user, total_expenses, note, status, feedback, date, base_commit_one, base_commit_two) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [id_user, fullname, worktime, cash, transfer_amount, transfer_amount_user, expenses, note, 0, "", todayy, commit_one, commit_two]);

    const result = await Promise.all(images.map(image => promisify(connection.query).call(connection, "INSERT INTO images (encode_image, id_bill) VALUES (?, ?)", [image, insertId])));

    res.status(200).send("add bill successfully");
  } catch (err) {
    console.log(err);
    res.status(500).send("Error add bill");
  }
});


app.post('/getimage', async (req, res) => {
  connection.query(`SELECT * FROM images WHERE id_bill = '${req.body.id}'`, (err, result) => {
    try {
      res.send(result);
    } catch (error) {
      console.log(err);

    }
  });
});

app.post('/bill/user', async (req, res) => {
  try {
    const today = new Date(req.body.day);
    const id_user = req.body.id_user;
    const mondayOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() + 2);
    const sundayOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() + 8);

    const mondayDate = mondayOfWeek.toISOString().slice(0, 10);
    const sundayDate = sundayOfWeek.toISOString().slice(0, 10);

    const query = `SELECT * FROM bill WHERE id_user = '${id_user}' AND date BETWEEN '${mondayDate}' AND '${sundayDate}'`;

    connection.query(query, function (error, results, fields) {
      if (error) {
        throw error; // Throw an error to be caught in the catch block
      }
      if (results.length > 0) {
        res.send({ status: "ok", results });
      } else {
        console.log(results);
        res.send({ status: "no", results });
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred");
  }
});

// app.post('/bill/user', async (req, res) => {
//   connection.query(`SELECT * FROM bill WHERE id_user = '${req.body.id}'`, (err, result) => {
//     console.log(result);
//     if (err) throw err;
//     const groupedData = {};
//     for (let i = 0; i < result.length; i++) {
//       const data = result[i];
//       const createdAt = new Date(data.date);
//       const weekNumber = getWeekNumber(createdAt);
//       console.log(getWeekNumber(createdAt));

//       if (!groupedData[`${weekNumber}`]) {
//         groupedData[`${weekNumber}`] = [];
//       }
//       groupedData[`${weekNumber}`].push(data);
//     }
//     // เรียงลำดับ groupedData ตาม id_bill
//     for (const key in groupedData) {
//       if (groupedData.hasOwnProperty(key)) {
//         groupedData[key].sort((a, b) => a.id_bill - b.id_bill);
//       }
//     }
//     res.send(groupedData);
//   });
//   function getWeekNumber(date) {
//     console.log(date);
//     const onejan = new Date(date.getFullYear(), 0, 1);
//     return Math.ceil((((date - onejan) / 86400000) + onejan.getDay() - 1) / 7);
//   }
// });

app.post('/bill/chart/user', async (req, res) => {
  const { id } = req.body;
  try {
    const query = 'SELECT * FROM bill WHERE id_user = ?';
    const results = await new Promise((resolve, reject) => {
      connection.query(query, [id], (error, results) => {
        if (error) {
          reject(error);
        } else {
          resolve(results);
        }
      });
    });
    const groupedData = {};
    for (let i = 0; i < results.length; i++) {
      const data = results[i];
      const createdAt = new Date(data.date);
      const weekNumber = getWeekNumber(createdAt);

      if (!groupedData[weekNumber]) {
        groupedData[weekNumber] = [];
      }
      groupedData[weekNumber].push(data);
    }
    const datacalculate = {};
    Object.keys(groupedData).forEach((key) => {
      let date = new Date(groupedData[key][0].date);
      const mondayOfWeek = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay() + 1);
      const sundayOfWeek = new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay() + 7);
      const mondayDate = formatDate(mondayOfWeek);
      const sundayDate = formatDate(sundayOfWeek);
      const dateformat = mondayDate + " - " + sundayDate;
      let datacal = 0;
      groupedData[key].forEach((data) => {
        datacal += data.total_cash + data.total_transfer;
        if (!datacalculate[key]) {
          datacalculate[key] = [];
        }
      });
      if (!datacalculate[key]) {
        datacalculate[key] = [];
      }
      datacalculate[key].push(datacal);
      datacalculate[key].push(dateformat);
    });

    res.json(datacalculate);
  } catch (error) {
    res.status(500).send('An error occurred');
  }
  function getWeekNumber(date) {
    const onejan = new Date(date.getFullYear(), 0, 1);
    const millisecsInDay = 86400000;
    return Math.ceil(((date - onejan) / millisecsInDay + onejan.getDay() - 1) / 7);
  }
  function formatDate(date) {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
});

app.post('/bill/user/update', async (req, res) => {
  const { id_bill, worktime, cash, transfer_amount, transfer_amount_user, expenses, note, imagesNew, imagesDelete } = req.body;
  // สร้าง JSON ข้อมูลที่จะอัปเดตในฐานข้อมูล
  const jsonData = {
    id_bill: id_bill,
    worktime: worktime,
    total_cash: cash,
    total_transfer: transfer_amount,
    total_transfer_user: transfer_amount_user,
    total_expenses: expenses,
    note: note,
    status: 0,
  };
  console.log(imagesDelete);
  // อัปเดตข้อมูลในฐานข้อมูล
  const query = 'UPDATE bill SET ? WHERE id_bill = ?';
  connection.query(query, [jsonData, id_bill], (error, results) => {
    if (error) {
      console.error('Error updating data:', error);
      res.status(500).json({ error: 'Error updating data' });
    } else {
      const query = `DELETE FROM images WHERE id_img IN (${imagesDelete.map(id => `'${id}'`).join(',')})`;
      connection.query(query, async (err, result) => {
        try {
          const result = await Promise.all(imagesNew.map(image => promisify(connection.query).call(connection, "INSERT INTO images (encode_image, id_bill) VALUES (?, ?)", [image, id_bill])));
          console.log('Data updated successfully');
          res.status(200).send("Data updated successfully");
        } catch (error) {
          console.log(err);
        }
      });
    }
  });
});

app.post('/bill/user/detail/update', async (req, res) => {
  const { id_bill, imagesNew, imagesDelete } = req.body;
  // const query = `DELETE FROM images WHERE id_img IN (${imagesDelete.map(id => `'${id}'`).join(',')})`;
  // connection.query(query, async (err, result) => {
  //   try {
  //     const result = await Promise.all(imagesNew.map(image => promisify(connection.query).call(connection, "INSERT INTO images (encode_image, id_bill) VALUES (?, ?)", [imagesNew, id_bill])));
  //     console.log('Data updated successfully');
  //     res.status(200).send("Data updated successfully");
  //   } catch (error) {
  //     console.log(err);
  //   }
  // });
  try {
    if (imagesDelete.length > 0) {
      const query = `DELETE FROM images WHERE id_img IN (${imagesDelete.map(id => `'${id}'`).join(',')})`;
      await util.promisify(connection.query).call(connection, query);
    }

    if (imagesNew.length > 0) {
      const result = await Promise.all(imagesNew.map(image => promisify(connection.query).call(connection, "INSERT INTO images (encode_image, id_bill) VALUES (?, ?)", [imagesNew, id_bill])));
      await Promise.all(result);
    }

    res.json({ status: "ok" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "An error occurred" });
  }
});

app.post("/admin/profile", (req, res, next) => {
  const id = req.body.id;
  console.log(id);
  connection.query(`SELECT * FROM admin WHERE id_admin IN (${id})`, (err, result) => {
    try {
      res.send(result);
    } catch (error) {
      console.log(err);
    }
  });
  // db.end();
});

app.post("/admin/profile/update", (req, res, next) => {
  const { id, username, password } = req.body;
  console.log(req.body);
  connection.query(`UPDATE admin SET name = ?, password = ? WHERE id_admin = ?`, [username, password, id], (err, result) => {
    try {
      res.json({ status: "ok", result });
    } catch (error) {
      console.log(err);
    }
  });
  // db.end();
});

app.post("/user/profile", async (req, res, next) => {

  console.log(req.body.id);
  connection.query(`SELECT * FROM user WHERE id_user = '${req.body.id}'`, (err, result) => {
    try {
      console.log(result);
      res.send(result);
    } catch (error) {
      console.log(err);
    }
  });
  // db.end();
});

app.post("/getname", async (req, res, next) => {

  connection.query(`SELECT * FROM user WHERE id_user = '${req.body.id}'`, (err, result) => {
    try {
      console.log(result[0].name_user);
      res.send(result[0].name_user);
    } catch (error) {
      console.log(err);
    }
  });
  // db.end();
});

app.post("/user/profile/update", (req, res, next) => {
  const { id, username, name, lastname, banking, phone, password } = req.body;
  console.log(req.body);
  connection.query(`UPDATE user SET username = ?, name_user = ?, lastname_user = ?, banking = ?, phone = ?, password_user = ?  WHERE id_user = ?`, [username, name, lastname, banking, phone, password, id], (err, result) => {
    try {
      res.json({ status: "ok", result });
    } catch (error) {
      console.log(err);
    }
  });
  // db.end();
});
app.post('/admin/bill', async (req, res) => {
  const today = new Date(req.body.day);
  console.log(req.body.day);
  console.log(today);

  const mondayOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() + 2);
  const sundayOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() + 8);

  const mondayDate = mondayOfWeek.toISOString().slice(0, 10);
  const sundayDate = sundayOfWeek.toISOString().slice(0, 10);

  console.log("monday: " + mondayDate);
  console.log("sunday: " + sundayDate);
  const query = `SELECT * FROM bill WHERE date BETWEEN '${mondayDate}' AND '${sundayDate}'`;

  connection.query(query, function (error, results, fields) {
    // res.send({ data: data, result: resul });

    if (results.length > 0) {
      const query2 = `SELECT id_user FROM bill WHERE date BETWEEN '${mondayDate}' AND '${sundayDate}'`;
      connection.query(query2, function (error, result, fields) {
        const mergedData = result.map((row) => {
          return row.id_user;
        });

        const uniqueData = Array.from(new Set(mergedData));

        const query3 = `SELECT id_user, name_user, lastname_user, banking FROM user WHERE id_user IN (?)`;

        // ใช้ตัวแปร uniqueData เป็น parameter ในการ query
        connection.query(query3, [uniqueData], (error, resul) => {
          if (error) {
            console.error(error);
          } else {
            if (error) throw error;
            const data = {};

            results.forEach((row) => {
              const { id_user } = row;
              if (!data[id_user]) {
                data[id_user] = [];
              }
              data[id_user].push(row);
            });
            res.send({ data: data, result: resul });
          }
        });
      });

    } else {
      results.forEach((row) => {
        const { id_user } = row;
        if (!data[id_user]) {
          data[id_user] = [];
        }
        data[id_user].push(row);
      });
      res.send({ status: "null" });
    }

  })
});

app.post('/admin/bill/submit', async (req, res) => {
  const { id_bill, feedback } = req.body;
  connection.query(
    "UPDATE bill SET status = ?, feedback = ?  WHERE id_bill = ?",
    [2, feedback, id_bill],
    (err, result) => {
      try {
        res.json({ status: "ok", result });
      } catch (error) {
        console.log(err);
      }
    }
  );
});

// app.post('/admin/bill/update', async (req, res) => {
//   const { id_bill, imagesNew, imagesDelete, feedback } = req.body;
//   console.log(req.body);
//   const query = `DELETE FROM images WHERE id_img IN (${imagesDelete.map(id => `'${id}'`).join(',')})`;
//   connection.query(query, async (err, result) => {
//     try {
//       const results = await Promise.all(imagesNew.map(image => util.promisify(connection.query).call(connection, "INSERT INTO images (encode_image, id_bill) VALUES (?, ?)", [image, id_bill])));
//       connection.query(
//         "UPDATE bill SET status = ?, feedback = ? WHERE id_bill = ?",
//         [1, feedback, id_bill],
//         (err, result) => {
//           try {
//             res.json({ status: "ok", result: results });
//           } catch (error) {
//             console.log(err);
//           }
//         });
//     } catch (error) {
//       console.log(err);
//     }
//   });
// });

app.post('/admin/bill/update', async (req, res) => {
  const { id_bill, imagesNew, imagesDelete, feedback } = req.body;
  console.log(req.body);
  try {
    if (imagesDelete.length > 0) {
      const query = `DELETE FROM images WHERE id_img IN (${imagesDelete.map(id => `'${id}'`).join(',')})`;
      await util.promisify(connection.query).call(connection, query);
    }

    if (imagesNew.length > 0) {
      const result = await Promise.all(imagesNew.map(image => promisify(connection.query).call(connection, "INSERT INTO images (encode_image, id_bill) VALUES (?, ?)", [imagesNew, id_bill])));

      await Promise.all(result);
    }
    console.log(feedback.length > 0);
    if (feedback.length > 0) {
      await util.promisify(connection.query).call(connection, "UPDATE bill SET status = ?, feedback = ? WHERE id_bill = ?", [1, feedback, id_bill]);
    }

    res.json({ status: "ok" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "An error occurred" });
  }
});

app.get("/admin/commission_setting", (req, res, next) => {
  connection.query('SELECT * FROM commission_setting ', (err, result) => {
    if (err) {
      console.log(err);
    } else {
      res.send(result);
    }
  });
  // db.end();
});

app.post("/admin/commission_setting/update", (req, res, next) => {
  const { id, commitone, committwo } = req.body;
  connection.query(`UPDATE commission_setting SET commision_one = ?, commision_two = ? WHERE id_commision  = ?`, [commitone, committwo, id], (err, result) => {
    try {
      console.log(req.body, err);
      console.log(result);
      res.json({ status: "ok", result });
    } catch (error) {
      console.log(err);
    }
  });
  // db.end();
});

app.post('/admin/chartweek/bill', async (req, res) => {
  const today = new Date(req.body.day);
  console.log(req.body.day);
  console.log(today);

  const mondayOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() + 2);
  const sundayOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() + 8);

  const mondayDate = mondayOfWeek.toISOString().slice(0, 10);
  const sundayDate = sundayOfWeek.toISOString().slice(0, 10);
  console.log(mondayDate = " monday");
  console.log(sundayDate = " sunday");

  const query = `SELECT * FROM bill WHERE date BETWEEN '${mondayDate}' AND '${sundayDate}'`;

  connection.query(query, function (error, results, fields) {
    // res.send({ data: data, result: resul });

    if (results.length > 0) {
      const query2 = `SELECT id_user FROM bill WHERE date BETWEEN '${mondayDate}' AND '${sundayDate}'`;
      connection.query(query2, function (error, result, fields) {
        const mergedData = result.map((row) => {
          return row.id_user;
        });
    
          if (error) {
            console.error(error);
          } else {
            if (error) throw error;
            const data = {};
            results.forEach((row) => {
              const { id_user } = row;
              if (!data[id_user]) {
                data[id_user] = [];
              }
              data[id_user].push(row);
            });
            const data_result = {};
            Object.keys(data).forEach((key) => {
              console.log(key);
              const result_cal = from_cal(data[key]);
              if (!data_result[key]) {
                data_result[key] = [];
              }
              data_result[key].push(result_cal.total);
              data_result[key].push(result_cal.name_user);
            })

            
            res.send(data_result);
          }
       
      });

    } else {
      results.forEach((row) => {
        const { id_user } = row;
        if (!data[id_user]) {
          data[id_user] = [];
        }
        data[id_user].push(row);
      });
      res.send({ status: "null" });
    }

  })
});

function from_cal(data) {
  // ส่วนของการประมวลผล
  const base_commit_one = data[0].base_commit_one;
  const base_commit_two = data[0].base_commit_two;
  let total_cash = 0;
  let transfer_amount = 0;
  let transfer_amount_user = 0;
  let expenses = 0;
  let name_user = data[0].name_user;
  const worktime1 = data.filter(item => item.worktime === 1).length; /// กรุงเทพ
  const worktime2 = data.filter(item => item.worktime === 2).length; /// พัทยา
  const id_bill = data[0].id_bill + ".1";
  for (let index = 0; index < data.length; index++) {
      total_cash += data[index].total_cash;
      transfer_amount += data[index].total_transfer;
      transfer_amount_user += data[index].total_transfer_user;
      expenses += data[index].total_expenses;
  }
  const total = parseInt(total_cash) + parseInt(transfer_amount);
  const tip = transfer_amount_user - transfer_amount;
  let sum_icom = 0;
  let commision = "";
  let percencom = 0;
  if (worktime1 === 0 && worktime2 > 0) { ///ถ้าไม่มีวิ่งในกรุงเทพ ///วิ่งพัทยาล้วน
      // console.log("พัทยาล้วน");
      percencom = base_commit_two * data.length;
  } else if (worktime2 === 0 && worktime1 > 0) { ///ถ้าไม่มีวิ่งในพัทยา ///วิ่งกรุงเทพล้วน
      // console.log("กรุงเทพล้วน");
      percencom = base_commit_one * data.length;
  } else if (worktime1 > 0 && worktime2 > 0) { ///วิ่งผสม 
      // console.log("วิ่งผสม");
      percencom = base_commit_one * worktime1 + base_commit_two * worktime2;
  }
  if (total >= (percencom * 0.5)) {
      sum_icom = total * 0.5;
      commision = " 0.5 หรือ 50%";
  } else if (total >= (percencom * 0.4)) {
      sum_icom = total * 0.4;
      commision = " 0.4 หรือ 40%";
  } else if (total >= (percencom * 0.3)) {
      sum_icom = total * 0.3;
      commision = " 0.3 หรือ 30%";
  } else if (total >= (percencom * 0.2)) {
      sum_icom = total * 0.2;
      commision = " 0.2 หรือ 20%";
  } else if (total >= (percencom * 0.1)) {
      sum_icom = total * 0.1;
      commision = " 0.1 หรือ 10%";
  } else {
      sum_icom = 0;
      commision = "ไม่ได้รับค่าคอมมิชชั่น";
  }

  const gross_income = sum_icom + tip;
  const net = total - expenses;
  const net_cut = net - transfer_amount;
  // ส่วนของการคืนค่า
  return { total_cash, transfer_amount, transfer_amount_user, expenses, total, commision, tip, sum_icom, gross_income, net, net_cut, id_bill, base_commit_one, base_commit_two, name_user };
}
app.listen(3001, () => console.log('Server started on port 3002'));
