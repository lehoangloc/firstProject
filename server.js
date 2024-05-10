var express = require('express');
const session = require('express-session');
var app = express();
let path = require("path");
var bodyPraser = require('body-parser');
app.use(express.urlencoded({extended: true, limit: '1mb'})); 
let pdf = require("html-pdf");
const fs = require('fs');
// set the view engine to ejs
let ejs = require("ejs");
app.set('view engine', 'ejs');
// use res.render to load up an ejs view file
const moment = require('moment');
// hash User/Password
const bcrypt = require('bcrypt');

app.use(session({ //API Session
  secret: 'secret-key',
  resave: false,
  saveUninitialized: true
}));

var mysql = require('mysql2');
var connection = mysql.createConnection({ //API kết nối CSDL
    host     : 'localhost',
    user     : 'root',
    password : '123456789',
    database : 'loc'
});
connection.connect(function(err){ //Thông báo kết nối CSDL
    if(!err) {console.log("Database is connected")} 
    else{console.log("Error while connecting with database")}
});

const hashPassword = async (password) => {// Hàm để mã hóa mật khẩu
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    return hashedPassword;
  } catch (error) {
    console.log('Lỗi mã hóa mật khẩu:', error);
    throw error;
  }
};

const util = require('util');
// Chuyển đổi các hàm callback thành Promises
const queryPromise = util.promisify(connection.query).bind(connection);
const query = util.promisify(connection.query).bind(connection);

// -----------------------------------API--------------------------------------//
// --------------------------------API Login-----------------------------------//

app.post('/register', async function(req, res) {
  res.sendFile('/register');
  });

app.get('/register',  function(req, res) {
  res.render('part/register', {
    full_name: '',
    user_name: '',
    password: '',
    department_id: '',
    mail: '',
    phone: ''
  });

});

app.post('/save', async function(req, res) {
  const { full_name, user_name, password, department_id, mail, phone } = req.body;
  const currentTime = moment();
  const mysqlTimestamp = currentTime.format('YYYY-MM-DD HH:mm:ss');
  let date_create = mysqlTimestamp;

  // Kiểm tra xem tên người dùng đã tồn tại chưa
  connection.query('SELECT * FROM admin_user WHERE user_name = ?', [user_name], async function(error, existingUser) {
    if (error) {
      console.error(error);
      return res.render('error', { error: 'Lỗi khi kiểm tra tên người dùng' });
    }

    if (existingUser.length > 0) {
      const errorMessage = 'Tên người dùng đã tồn tại. Vui lòng chọn tên người dùng khác.';
      return res.render('part/register', { errorMessage: errorMessage, full_name, user_name, password, department_id, mail, phone, date_create });
    }

    try {
      // Hash mật khẩu
      const hashedPassword = await hashPassword(password);

      // Thêm người dùng mới vào cơ sở dữ liệu
      connection.query('INSERT INTO admin_user (full_name, user_name, password, department_id, mail, phone, date_create) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [full_name, user_name, hashedPassword, department_id, mail, phone, date_create], function(error, result) {
          if (error) {
            console.error(error);
            return res.render('error', { error: 'Lỗi khi lưu dữ liệu' });
          }

          console.log("Insert into admin_user is successful!");
          res.redirect('/register'); //Tạo trang thông báo Tạo user thành công, then res.redirect('/register') or trang view danh sách user
        });
    } catch (error) {
      console.error(error);
      res.render('error', { error: 'Lỗi khi băm mật khẩu' });
    }
  });
});

app.post('/login', async function(req, res) {
  const { user_name, password } = req.body;

  try {// Tìm người dùng trong cơ sở dữ liệu
    const rows = await query('SELECT * FROM admin_user WHERE user_name = ?', [user_name]);

    if (rows.length === 0) {
      const errorMessage = 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin đăng nhập.';
      res.render('part/check-user', { errorMessage: errorMessage });
    } else {
      const user = rows[0];

      if (!user || !user.password) {
        const errorMessage = 'Lỗi cấu trúc dữ liệu người dùng.';
        res.render('part/check-user', { errorMessage: errorMessage });
      } else {
        // So sánh mật khẩu đã mã hóa với mật khẩu nhập vào
        const isPasswordMatch = await bcrypt.compare(password, user.password);

        if (isPasswordMatch) {
          // Lưu thông tin người dùng trong session
          req.session.user = user;

          // Điều hướng người dùng sau khi đăng nhập thành công
          res.redirect('/home');
        } else {
          const errorMessage = 'Đăng nhập không thành công. Vui lòng kiểm tra lại thông tin đăng nhập.';
          res.render('part/check-user', { errorMessage: errorMessage });
        }
      }
    }
  } catch (error) {
    console.error(error);
  }
});

app.get('/login', function(req, res) {// Kiểm tra xem người dùng đã đăng nhập hay chưa
  if (req.session.user) {return res.render('/welcome')};
  res.render('part/check-user');
});

app.get('/logout', function(req, res) {// Xóa thông tin người dùng khỏi session
  req.session.destroy();
  res.redirect('/login');// Điều hướng người dùng sau khi đăng xuất thành công
});

app.get('/welcome', Login, async function(req, res) {// Lấy thông tin người dùng từ session
  const obj = { print: null };
  const user = req.session.user;
  const id = req.session.user.user_id;
  const resultMember = await executeQuery(`SELECT @rownum := @rownum + 1 AS stt, a.*,  
                                                  DATE_FORMAT(a.date_add_member, '%d/%m/%Y') AS date_add_member_new, 
                                                  DATE_FORMAT(a.date_report, '%d/%m/%Y') AS date_report_new
                                                FROM (SELECT @rownum := 0) r, event_group a
                                                WHERE a.status >= 0 
                                                  AND a.user_id_member = ? order by a.date_add_member desc`, [id]);
if (resultMember && resultMember.length > 0) {
      obj.printMem = resultMember;
      }
      
      // console.log(id);
  res.render('welcome', { user: user, obj: obj });
});

function requireLogin(req, res, next) {// Function gắn vào middleware cho các route cần kiểm tra đăng nhập
  if (!req.session.user) {
    return res.redirect('/login');
  }
  if (req.session.user.department_id !== 1) {
    return res.render('part/0-access-decline');
  }
  req.user = req.session.user;
  next();
}

function Login(req, res, next) {// Function gắn vào middleware cho các route cần kiểm tra đăng nhập
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

// ---------------------------------API Home-----------------------------------//
// ----------------------------------RESTful-----------------------------------//
app.get('/home', requireLogin, async function(req, res) {
  try {
    const obj = { print: null };
    const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
    const user_id_perform = req.session.user.user_id;
    
    for (const month of months) {
      const result = await executeQuery(`select  a.*, b.user_id_member 
                                          from thang${month} a, event_group b 
                                          where a.id = b.event_id 
                                            and b.status = 1 
                                            and a.status = 1 
                                            and b.user_id_member in (?)`,[user_id_perform]);
      obj[`printT${month}`] = result;
    }
    const print = [];

    res.render("./route-all", { obj: obj, print: print,  user: req.session.user, user_id_perform });
  }
  catch (err) {console.error(err);
                res.status(500).send('Internal Server Error');
  }
});

app.get('/home-show/:id', requireLogin, async function(req, res) {
  try {
    const id = req.params.id;
    const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
    const obj = { print: null };
    // Nội dung sự kiện
    for (const month of months) {
      const queryMonth = ` SELECT * FROM THANG${month} where id =?` ;
      const resultMonth = await executeQuery(queryMonth, [id]);
      obj[`printT${month}`] = resultMonth;
    }
    //Nội dung Thành viên tham gia
    const queries = months.map(month => ({
      query: `SELECT *
                FROM THANG${month} WHERE id = ?`
    }));

    for (const { query } of queries) {
      const result = await executeQuery(query, [id]);
      if (result && result.length > 0) {
        obj.print = result;
      } //else {console.log("Some thing wrong at /home-show/:id" +id)}
    }

    const resultMember = await executeQuery(`SELECT @rownum := @rownum + 1 AS stt, a.*, b.full_name, 
                                                    DATE_FORMAT(a.date_add_member, '%d/%m/%Y') AS date_add_member_new, 
                                                    DATE_FORMAT(a.date_report, '%d/%m/%Y') AS date_report_new
                                              FROM (SELECT @rownum := 0) r, event_group a, admin_user b
                                              WHERE a.status = 1 
                                                AND a.user_id_member = b.user_id 
                                                AND a.event_id=?`, [id]);
    if (resultMember && resultMember.length > 0) {
    obj.printMem = resultMember;
    }

    const { print, ...printTs } = obj;

    const user_id_operation = req.session.user.user_id;

    res.render('./route-all', { obj, print, ...printTs, id, user_id_operation, user: req.session.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/edit/:id', requireLogin, async (req, res) => {
  try {
    const id = req.params.id;
    const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
    const obj = { print: null };
    const user_id_perform = req.session.user.user_id;

    // Nội dung sự kiện <Header>/ 2024 và <Div> Main-right/ Nội dung Sự kiện:
    for (const month of months) {
      const queryMonth = `select  a.*, b.user_id_member 
                          from thang${month} a, event_group b 
                          where a.id = b.event_id 
                            and b.status = 1 
                            and a.status = 1 
                            and a.id = ?
                            and b.user_id_member in (?)`;
      const resultMonth = await executeQuery(queryMonth, [id, user_id_perform]);
      obj[`printT${month}`] = resultMonth;
    }

    //<Div> Main-left/ Chỉnh sữa nội dung: 
    // ---> Thanh <select>/ Thêm thành viên: ID - Full_name  
    const emp_fullname = `SELECT * FROM admin_user`;
    const fullNamesResult = await executeQuery(emp_fullname);
    const fullNames = fullNamesResult.map(result => result.full_name);
    const memUserID = fullNamesResult.map(result => result.user_id);
    
    //Nội dung Thành viên tham gia <Div> Main-right/ Danh sách Thành viên tham gia:
    const resultMember = await executeQuery(`SELECT @rownum := @rownum + 1 AS stt, a.*, b.full_name, 
                                                    DATE_FORMAT(a.date_add_member, '%d/%m/%Y') AS date_add_member_new, 
                                                    DATE_FORMAT(a.date_report, '%d/%m/%Y') AS date_report_new
                                              FROM (SELECT @rownum := 0) r, event_group a, admin_user b
                                              WHERE a.status = 1 
                                                AND a.user_id_member = b.user_id 
                                                AND a.event_id=?`, [id]);
    if (resultMember && resultMember.length > 0) {
        obj.printMem = resultMember;}

    //<Div> Main-left/ Chỉnh sữa nội dung: 
    // ---> <Input>/ Tên sự kiện && Nội dung chi tiết
    const queries = months.map(month => ({
      query: `select  a.id,	a.name,	a.detail,	a.status,	
                      DATE_FORMAT(a.date_create, '%d/%m/%Y') AS date_create, 
                      b.user_id_member 
              from thang${month} a, event_group b 
              where a.id = b.event_id 
                and b.status = 1 
                and a.status = 1 
                and a.id = ?
                and b.user_id_member in (?)`,
      variable: `dataT${month}`
    }));
    for (const { query, variable } of queries) {
      const result = await executeQuery(query, [id, user_id_perform]);
      if (result && result.length > 0) {
        obj.print = result;
        obj[variable] = {
          id: result[0].id,
          name: result[0].name,
          detail: result[0].detail
        };
      } else {
        obj[variable] = null;}
    }
    const { print, ...printTs } = obj;

    res.render('./route-edit', { obj, print, ...printTs, id, 
                                    fullNames, memUserID, user_id_perform, 
                                    user: req.session.user });
  } catch (err) {
    console.error(err);
     // Kiểm tra xem lỗi có phải là "Cannot read properties of null"
      if (err instanceof TypeError && err.message.includes('Cannot read properties of null')) {
        res.status(400).send('Invalid data: Cannot read properties of null');
      } else {
        res.status(500).send('Internal Server Error');
      }
    }
});

app.post('/update/(:id)', requireLogin, (req, res) => {
  const id = req.params.id;
  const { name, detail } = req.body;
  const currentTime = moment();
  const mysqlTimestamp = currentTime.format('YYYY-MM-DD HH:mm:ss');
  // console.log(mysqlTimestamp) ;
  let date_update = mysqlTimestamp;
  let table;

  if      (id < 2000) {table = 'THANG01';} 
  else if (id < 3000) {table = 'THANG02';} 
  else if (id < 4000) {table = 'THANG03';} 
  else if (id < 5000) {table = 'THANG04';} 
  else if (id < 6000) {table = 'THANG05';} 
  else if (id < 7000) {table = 'THANG06';}
  else if (id < 8000) {table = 'THANG07';}
  else if (id < 9000) {table = 'THANG08';} 
  else if (id < 10000) {table = 'THANG09';}
  else if (id < 11000) {table = 'THANG10';}
  else if (id < 12000) {table = 'THANG11';} 
  else                 {table = 'THANG12';}

  const query = `UPDATE ${table} SET name = ?, detail = ?, date_update = ? WHERE id = ?`;

  connection.query(query, [name, detail, date_update, id], (err, result) => {
    if (err) {
      console.error('Error updating record: ', err);
      res.status(500).send('Error updating record');
      return;
    }
    console.log("Edit is Successful!");
    res.redirect('/edit/' +id);
  });
});

app.post('/add/:id', requireLogin, async (req, res) => {
  try {
    const id = req.params.id;
    const { user_id, full_name } = JSON.parse(req.body['{"user_id": "", "full_name": ""}']);
    const decodedFullName = decodeURIComponent(full_name);
    const currentTime = moment();
    const mysqlTimestamp = currentTime.format('YYYY-MM-DD HH:mm:ss');
    const date_create = mysqlTimestamp;
  
    // Sử dụng thông tin user_session từ user đăng nhập
    const user_id_perform = req.session.user.user_id;
    const user_perform = req.session.user.user_name;

    const query = 'INSERT INTO event_group (event_id, user_id_member, user_member, date_add_member, user_add_member, user_id_add_member) VALUES (?, ?, ?, ?, ?, ?)';
    const result = await executeQuery(query, [id, user_id, decodedFullName, date_create, user_perform, user_id_perform]);
  
    console.log(`Insert Member into Event ID: ${id}, user_id: ${user_id}, full_name: ${decodedFullName} is Successful!`);
    res.redirect('/edit/'+id);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/del-member/:eg_id', requireLogin, async (req, res) => {
  try {
    var eg_id = req.params.eg_id;
    const queryID = 'SELECT event_id FROM event_group WHERE event_group_id = ?';
    const resultID = await executeQuery(queryID, [eg_id]);
    const event_id = resultID[0].event_id;
    const currentTime = moment();
    const mysqlTimestamp = currentTime.format('YYYY-MM-DD HH:mm:ss');
    const date_delete = mysqlTimestamp;
  
    // Sử dụng thông tin user_session từ user đăng nhập
    const user_id_perform = req.session.user.user_id;
    const user_perform = req.session.user.user_name;

    const query = 'UPDATE event_group SET status = 0, date_remove = ?, user_remove = ?, user_id_remove = ? WHERE event_group_id =?';
    const result = await executeQuery(query, [date_delete, user_perform, user_id_perform, eg_id]);
  
    console.log(`Delete Member from Event ID: ${eg_id} is Successful!`);
    res.redirect('/edit/'+event_id);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/edit-work-granted/:eg_id', requireLogin, async (req, res) => {
  try {
    const eg_id = req.params.eg_id;
    // Lấy phần tử đầu tiên của event_id = id <table - thangXX>
    const queryID = 'SELECT event_id FROM event_group WHERE event_group_id = ?';
    const resultID = await executeQuery(queryID, [eg_id]);
    const id = resultID[0].event_id;

    // Nội dung sự kiện - Phần Header
    const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
    const obj = { print: null };
    for (const month of months) {
      const queryMonth = `SELECT * FROM THANG${month} WHERE id = ?`;
      const resultMonth = await executeQuery(queryMonth, [id]);
      obj[`printT${month}`] = resultMonth;
    }

    //<Div> Main-left/ Chỉnh sữa nội dung: 
    // ---> Thanh <select>/ Thêm thành viên: ID - Full_name  
    const emp_fullname = `SELECT * FROM admin_user`;
    const fullNamesResult = await executeQuery(emp_fullname);
    const fullNames = fullNamesResult.map(result => result.full_name);
    const memUserID = fullNamesResult.map(result => result.user_id);
    
    //Nội dung Thành viên tham gia <Div> Main-right/ Danh sách Thành viên tham gia:
    const resultMember = await executeQuery(`SELECT @rownum := @rownum + 1 AS stt, a.*, b.full_name, 
                                                    DATE_FORMAT(a.date_add_member, '%d/%m/%Y') AS date_add_member_new, 
                                                    DATE_FORMAT(a.date_report, '%d/%m/%Y') AS date_report_new
                                              FROM (SELECT @rownum := 0) r, event_group a, admin_user b
                                              WHERE a.status = 1 
                                                AND a.user_id_member = b.user_id 
                                                AND a.event_id=?`, [id]);
    if (resultMember && resultMember.length > 0) {
      obj.printMem = resultMember;}

    
    const updateMEM = 'SELECT event_group_id FROM event_group WHERE event_group_id = ?';
    const resultUpdateMEM = await executeQuery(updateMEM, [eg_id]);
    const result =  resultUpdateMEM[0].event_group_id;

    const user_id_perform = req.session.user.user_id;
    //event_user_grant, event_user_perform
    const queries = months.map(month => ({
      query: `select  a.*, DATE_FORMAT(a.date_create, '%d/%m/%Y') AS date_create_new, 
                      b.user_id_member 
              from thang${month} a, event_group b 
              where a.id = b.event_id 
                and b.status = 1 
                and a.status = 1 
                and a.id = ?
                and b.user_id_member in (?)`,
      variable: `dataT${month}`
    }));
    for (const { query, variable } of queries) {
      const result = await executeQuery(query, [id, user_id_perform]);
      if (result && result.length > 0) {
        obj.print = result;
        obj[variable] = {
          id: result[0].id,
          name: result[0].name,
          detail: result[0].detail
        };
      } else {
        obj[variable] = null;}
    }
    const { print, ...printTs } = obj;

    res.render('./route-edit-work-granted', { obj, print, ...printTs, id, fullNames, memUserID, resultMember, 
                                              result, eg_id: eg_id, user: req.session.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/update-work-granted/(:eg_id)', requireLogin, async (req, res) => {
  var eg_id = req.params.eg_id;
  const { work_granted, work_report } = req.body;

  const queryID = 'SELECT event_id FROM event_group WHERE event_group_id = ?';
  const resultID = await executeQuery(queryID, [eg_id]);
  const id = resultID[0].event_id;

  const currentTime = moment();
  const mysqlTimestamp = currentTime.format('YYYY-MM-DD HH:mm:ss');
  // console.log(mysqlTimestamp) ;
  let date_update = mysqlTimestamp;

  const user_id_perform = req.session.user.user_id;
  const user_perform = req.session.user.user_name;

  const query = `UPDATE event_group SET work_granted = ?, date_update_granted = ?,  
  user_grant = ?, user_id_grant = ? WHERE event_group_id = ?`;

  connection.query(query, [work_granted, date_update, user_perform, user_id_perform, eg_id], (err, result) => {
    if (err) {
      console.error('Error updating record: ', err);
      res.status(500).send('Error updating record');
      return;
    }
    console.log("Edit content member is Successful!" +eg_id);
    res.redirect('/edit/'+id);
  });
});

app.get('/edit-work-report/:eg_id', requireLogin, async (req, res) => {
  try {
    const eg_id = req.params.eg_id;
    const queryID = 'SELECT event_id FROM event_group WHERE event_group_id = ?';
    const resultID = await executeQuery(queryID, [eg_id]);
    const id = resultID[0].event_id;

    const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
    const obj = { print: null };

    for (const month of months) {
      const queryMonth = `SELECT * FROM THANG${month} WHERE id = ?`;
      const resultMonth = await executeQuery(queryMonth, [id]);
      obj[`printT${month}`] = resultMonth;
    }

    const emp_fullname = `SELECT * FROM admin_user`;
    const fullNamesResult = await executeQuery(emp_fullname);
    const fullNames = fullNamesResult.map(result => result.full_name);
    const memUserID = fullNamesResult.map(result => result.user_id);
    

    const resultMember = await executeQuery(`SELECT @rownum := @rownum + 1 AS stt, a.*, b.full_name, 
                                                    DATE_FORMAT(a.date_add_member, '%d/%m/%Y') AS date_add_member_new, 
                                                    DATE_FORMAT(a.date_report, '%d/%m/%Y') AS date_report_new
                                              FROM (SELECT @rownum := 0) r, event_group a , admin_user b
                                              WHERE a.status = 1 
                                                AND a.user_id_member = b.user_id 
                                                AND a.event_id=?`, [id]);
    if (resultMember && resultMember.length > 0) {
      obj.printMem = resultMember;}

    const updateMEM = 'SELECT event_group_id FROM event_group WHERE event_group_id = ?';
    const resultUpdateMEM = await executeQuery(updateMEM, [eg_id]);
    const result =  resultUpdateMEM[0].event_group_id;


    //
    const queries = months.map(month => ({
      query: `SELECT a.id, a.name, a.detail, DATE_FORMAT(a.date_create, '%d/%m/%Y') AS date_create_new, 
              b.* 
              FROM thang${month} a, event_group b
              WHERE a.id = b.event_id
                AND a.status = 1 AND b.status = 1
                AND event_group_id = ?`,
      variable: `dataT${month}`
    }));

    for (const { query, variable } of queries) {
      const result = await executeQuery(query, [eg_id]);
      if (result && result.length > 0) {
        obj.print = result;
        obj[variable] = {
          eg_id: result[0].eg_id,
          work_report: result[0].work_report,
        };
      } else {
        obj[variable] = null;}
    }

    const { print, ...printTs } = obj;
    res.render('./route-edit-work-report', { obj, print, ...printTs, id, 
                                               fullNames, memUserID, resultMember, result, eg_id: eg_id,
                                               user: req.session.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/update-work-report/(:eg_id)', requireLogin, async (req, res) => {
  var eg_id = req.params.eg_id;
  const { work_report } = req.body;

  const queryID = 'SELECT event_id FROM event_group WHERE event_group_id = ?';
  const resultID = await executeQuery(queryID, [eg_id]);
  const id = resultID[0].event_id;

  const currentTime = moment();
  const mysqlTimestamp = currentTime.format('YYYY-MM-DD HH:mm:ss');
  // console.log(mysqlTimestamp) ;
  let date_update = mysqlTimestamp;

  const user_id_perform = req.session.user.user_id;
  const user_perform  = req.session.user.user_name;

  const query = `UPDATE event_group SET work_report = ?, date_report = ?,  
  user_report = ?, user_id_report = ? WHERE event_group_id = ?`;

  connection.query(query, [ work_report, date_update, user_perform, user_id_perform, eg_id], (err, result) => {
    if (err) {
      console.error('Error updating record: ', err);
      res.status(500).send('Error updating record');
      return;
    }
    console.log("Edit content is Successful!" +eg_id);
    res.redirect('/edit/'+id);
  });
});

function executeQuery(query, params) {
  return new Promise((resolve, reject) => {
    connection.query(query, params, function (err, result) {
      if (err) {reject(err);} 
      else {resolve(result);}
    });
  });
}

// ------------------------------- API THANG ---------------------------------//
// Table: THANG01 //
//----------------//
app.get('/add-thang01', requireLogin, function(req, res){
  const currentTime = moment();
  const mysqlTimestamp = currentTime.format('YYYY-MM-DD HH:mm:ss');
  let date_create = mysqlTimestamp;

  
  const user_id_perform = req.session.user.user_id;
  const user_perform = req.session.user.user_name;

  connection.query(`insert into THANG01 (date_create, user_create, user_id_create) values(?, ?, ?) `,
                                        [date_create, user_perform, user_id_perform], function(err){
    if(!!err) {console.log("error", +err);}
    else{
      console.log("Insert into Thang01 is Successful!");
      res.redirect('/add-thang01-member-original');
      //res.json({"data":"Data Inserted Successfully!"});
    }
  }); 
})

app.get('/add-thang01-member-original', requireLogin, function(req, res) {
  connection.query('SELECT MAX(id) AS max_id FROM thang01', function(err, rows) {
    if (err) {
      console.log('Error:', err);
      return;
    }

    const event_id_member = rows[0].max_id;
    const currentTime = moment().format('YYYY-MM-DD HH:mm:ss');
    const event_user_id_perform = req.session.user.user_id;
    const event_user_perform = req.session.user.user_name;
    

    const query = `INSERT INTO event_group (event_id, user_id_create, user_create, 
                                            date_create,
                                            user_id_member, user_member, date_add_member) 
                                            VALUES (?, ?, ?, ?, ?, ?, ? )`;

    connection.query(query, [event_id_member, event_user_id_perform, event_user_perform, currentTime, event_user_id_perform, event_user_perform, currentTime], function(err) {
      if (err) {
        console.log('Error:', err);
        return;
      }

      console.log('Insert into Thang01 is successful!');
      res.redirect('/home');
    });
  });
});

app.get('/del-thang01/(:id)', requireLogin, function(req, res){
  var id = req.params.id;
  const currentTime = moment();
  const mysqlTimestamp = currentTime.format('YYYY-MM-DD HH:mm:ss');
  let date_delete = mysqlTimestamp;
  
      connection.query(`update THANG01 set status = 0, date_delete = ? where id =? `, [date_delete, id], function(err){
        if(!!err){
          console.log("error", +err);
          res.redirect('/home')}
        else{
          console.log("Delete id "+ id +" is Successful!");
          return res.redirect('/home')}
      });
})

app.get('/show-thang01', requireLogin, async function(req, res) {
  try {
    const obj = { print: null };
    const months = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
    const user_id_operation = req.session.user.user_id;
    
      const results = await executeQuery(`SELECT @rownum := @rownum + 1 AS stt, a.*, DATE_FORMAT(a.date_create, '%d/%m/%Y') AS date_create_new, b.user_id_member 
                                          FROM (SELECT @rownum := 0) r, thang01 a, event_group b 
                                          WHERE a.id = b.event_id 
                                            AND b.status = 1 
                                            AND a.status = 1 
                                            AND b.user_id_member in (?)`, [user_id_operation]);
      obj.print = results;
    
    
    for (const month of months) {
      const resultT = await executeQuery(`SELECT a.*, b.user_id_member 
                                          FROM thang${month} a, event_group b 
                                          WHERE a.id = b.event_id 
                                            AND b.status = 1 
                                            AND a.status = 1 
                                            AND b.user_id_member in (?)`, [user_id_operation]);
      obj[`printT${month}`] = resultT;
    }

    const print = [];

    res.render("./route-show-thangXX", { obj: obj, print: print, user_id_operation: user_id_operation, user: req.session.user });
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal Server Error');
  }
});
