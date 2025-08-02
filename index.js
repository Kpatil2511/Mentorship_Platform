const express = require('express')
const path = require('path')
const app = express()
app.use(express.json());
app.use(express.urlencoded({ extended: true}))
const pool = require('./db')
const port = 3000
const { v4: uuidv4 } = require('uuid');
const session = require('express-session');  //Import express-session
const { engine } = require('express-handlebars');

app.engine('hbs', engine({ extname: 'hbs'}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Configure session middleware
app.use(session({
  secret: 'Iwillbemillionaireby2030owningtheporscheandrollsroyce',
  resave: false, //Don't save session if unmodified
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24
  }
}));

function requireLogin (req, res, next) {
  if (!req.session.userId) {
    console.log("User not logged in. Redirecting to /login");
    res.redirect('/login');
    return;

  }
  else {
    console.log("User logged in. Proceeding.");
    next();
  }

}

// Middleware to check if a mentor is logged in
function requireMentorLogin ( req, res, next) {
  if (!req.session.mentorId) {
    console.log("Mentor not logged in. Redirecting to /mentor-login");
    res.redirect('/mentor-login');
    return;
  }
  console.log("Mentor logged in. Proceeding.");
  next();
}

// Helper function to slugify a string for URL-friendly names
function slugify(text) {
  return text
    .toString()
    .normalize('NFD')  // Normalize diacritics
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') //Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/--+/g, '-'); // Replace multiple - with single -
}

app.use(express.static(path.join(__dirname,"public")))
app.use('/uploads', express.static(path.join(__dirname, "public/uploads")))

const multer = require('multer');
const fs = require('fs');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadpath = path.join(__dirname, 'public/uploads');

    //Ensure uploads folder exists
    if (!fs.existsSync(uploadpath)) {
      fs.mkdirSync(uploadpath, { recursive: true});
    }
    cb(null, uploadpath);
  },

  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = file.originalname.split('.').pop();
    cb(null, `${file.fieldname}-${uniqueSuffix}.${extension}`);
  
  }
});

const upload = multer({ storage: storage});




app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '/public/homepage.html'))
})

app.get('/about', (req, res) => {
    res.send('I have started to go my way')
  })

app.get('/form', (req, res) => {
    //res.send('Hello World!')
    res.sendFile(path.join(__dirname, '/public/form.html'))
 // res.json({"Kanhaiya":62})  
})  

app.get('/mentor', (req,res) => {
  res.sendFile(path.join(__dirname, '/public/mentor.html'))
})

app.post('/api/create-user', async(req,res) => {
  try{
    const data = req.body

    console.log("FullName: ", data.fullname)
    console.log("email: ", data.email)
    console.log("user_id: ", data.user_id)
    console.log("password: ",data.password)
    
    const { fullname, email, user_id, password  } = data;

    const result = await pool.query(
        "INSERT INTO users (fullname, email, user_id, password) VALUES ($1, $2, $3, $4)",
        [fullname,email,user_id,password]
    );

    res.send('User data received')

  } catch(error){
    console.error("Error inserting user:", error.message)
    res.status(500).send("Something went wrong:" + error.message)}
  })

  app.post('/api/create-mentor', upload.single('image'), async(req,res) => {
    const data = req.body

    console.log("fullname: ", data.fullname)
    console.log("email: ", data.email)
    console.log("password: ", data.password)
    console.log("Mentor_Id: ", data.Mentor_Id)
    console.log("bio: ", data.bio)
    console.log("designation", data.designation)
    console.log("company", data.company)
    console.log("location", data.location)
    console.log("linkedin_url", data.linkedin_url)

    const image =req.file.filename;

    const { fullname, email, password, Mentor_Id, bio, designation, company, location, linkedin_url} = data;
    let client; //declared client here
    try{

       client = await pool.connect();

      
        await client.query('BEGIN')

        const mentorInsert = await client.query(
          'INSERT INTO Mentor (fullname, email, bio, password, Mentor_Id) VALUES ($1, $2, $3, $4, ($5)::int) RETURNING MENTOR_Id',
          [fullname, email, bio, password, Mentor_Id]
        );

        const mentorId = mentorInsert.rows[0].mentor_id;

        await client.query(
          'INSERT INTO Mentor_profile (mentor_id, designation, company, location, linkedin_url, image) VALUES ($1, $2, $3, $4, $5, $6)',
          [mentorId, designation, company, location, linkedin_url, image]
        );

        await client.query('COMMIT');
        res.status(200).json({ message: 'Mentor created successfully'});
  } catch(err) {
    await client.query('ROLLBACK');
    console.error('Error inserting mentor and profile', err);
    res.status(500).json({error: 'Failed to create Mentor'});
  } finally {
    if(client){
    client.release(); //always release the client back to the pool
  }
  }


   
  })

  app.post('/api/login', async (req,res) => {
    const data = req.body

    console.log("email: ", data.email)
    console.log("password: ", data.password)

    const {email, password} = data;

    let client;
    try {
      client = await pool.connect();

      const query = `
      SELECT email, password, user_id
      FROM users
      WHERE email = $1 AND password = $2
      `;

      

      const result = await client.query(query, [email, password]);

      if (result.rows.length>0) {
        const user = result.rows[0];
        req.session.userId = user.user_id;
        console.log("Session userId set:", req.session.userId);
        res.json({ success: true, message:"Login successful"});
      } else {
        res.status(401).json({ success: false, message: "Invalid email or password"});
      }
    } catch(error) {
      console.error("Error during login:", error.message);
      res.status(500).json({ success: false, message: "Internal server error during login."})
    } finally {
      if(client) {
      client.release();
      }
    }
  });

  app.post('/api/book-session', async (req,res) => {

    console.log("Request Body:", req.body);
    
      const { mentor_id,start_time, end_time, feedback, email } = req.body;

      console.log("Received mentor_id from frontend", mentor_id);

      let client;
      try{

       client = await pool.connect();

      

        const userResult = await client.query(
          'SELECT user_id FROM users WHERE email = $1',
          [email]
        );
        if (userResult.rows.length === 0) {
          return res.status(400).json({ error: 'User not found'});
        }
        const User_Id = userResult.rows[0].user_id;

       //3. Create UUID for session_id
        const session_id = uuidv4();

        //4. Insert into sessions table

        await client.query(
          `INSERT INTO sessions (session_id, user_id, mentor_id, start_time, end_time, feedback, session_status)
           VALUES ($1,$2, ($3)::int, $4, $5, $6, $7)`,
           [session_id, User_Id, mentor_id, start_time, end_time, feedback, 'scheduled']
          

        );

        res.status(200).json({ message: "Session booked successfully", session_id});


      } catch(err) {
        console.error("Booking Error:", err.message);
        res.status(500).json({ error: "Something went wrong", details:err.message});

      } finally {
        if(client) {
        client.release();
      }
    }

      
    
  });

  app.post('/api/mentor-login', async (req, res) => {
    const { email, password} = req.body;
    console.log("Mentor Login Attempt - Email:", email);

    let client;
    try {
      client = await pool.connect();
      const query = `
      SELECT mentor_id, email, password, fullname
      FROM Mentor 
      WHERE email = $1 AND password = $2
      `;
      const result = await client.query(query, [email, password]);

      if (result.rows.length > 0) {
        const mentor = result.rows[0];
        req.session.mentorId = mentor.mentor_id; //store mentor_id in session
        const mentorSlug = slugify(mentor.fullname);
        console.log("Session mentorId set:", req.session.mentorId);
        res.json({ success: true, message: "Mentor login successful", redirectUrl: `/mentor/${mentorSlug}`});
      } else {
        res.status(401).json({ success: false, message: "Invalid email or password"});
      }
    } catch (error) {
      console.error("Error during mentor login:", error.message);
      res.status(500).json({ success:false, message: "Internal server error during mentor login."});
    } finally {
      if(client) {
        client.release();
      }
    }
  });

  app.get('/api/mentors', async(req,res) => {

    try{
    
    const fetch = await pool.query(
      `SELECT M.Mentor_Id, M.fullname, p.designation, p.company, M.bio, p.image
      FROM Mentor AS M
      INNER JOIN Mentor_profile as p 
      ON M.Mentor_Id = p.Mentor_Id
      
     
    `);
    res.json(fetch.rows);
    }catch(error){
      console.error("Error in fetching mentor profile data",error.message)
      res.status(500).json({ error: "Internal Server Error"});
    }

  })

  app.get('/available-mentors', requireLogin, (req, res) => {
    res.sendFile(path.join(__dirname, '/public/mentor-list.html'))
  })

  app.get('/book-session/:Mentor_Id', (req,res) => {
    res.sendFile(path.join(__dirname, '/public/book-session.html'));
  });

  app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '/public/login.html'));
  });

  app.get('/mentor-login', (req, res) => {
    console.log('Attempting to render view: mentor-login from path:', path.join(app.get('views'), 'mentor-login.hbs'));
    
    res.render('mentor-login');
  })

  app.get('/mentor/:mentorNameSlug', requireMentorLogin, async (req, res) => {
    const mentorNameSlug = req.params.mentorNameSlug;
    const loggedInMentorId = req.session.mentorId;
    console.log("Accessing mentor profile for slug:", mentorNameSlug, "by logged-in mentor ID:", loggedInMentorId);

    let client;
    try {
      client = await pool.connect();
      const query = `
        SELECT M.fullname, M.email, M.bio, P.designation, P.company, P.location, P.linkedin_url, P.image
        FROM Mentor AS M
        JOIN Mentor_profile AS P ON M.mentor_id = P.mentor_id
        WHERE M.mentor_id = $1::int 
        `;
        const result = await client.query(query, [loggedInMentorId]);

        if (result.rows.length > 0) {
          const mentor = result.rows[0];
          const actualMentorSlug = slugify(mentor.fullname);

          // Verify if the slug in the URL matches the actual slug of the logged-in mentor
          if (actualMentorSlug === mentorNameSlug) {
          res.render('mentor-profile', { mentor: mentor});
          } else {
            // If logged-in mentor tries to access another mentor's profile via URL manipulation
            console.warn(`Logged-in mentor (ID: ${loggedInMentorId}) attempted to access slug "${mentorNameSlug}" which does not match their own slug "${actualMentorSlug}". Redirecting.`);
            res.redirect(`/mentor/${actualMentorSlug}`);
          }  // Render new mentor-profile.hbs
        } else {
          console.error(`Mentor with ID ${loggedInMentorId} not found in DB despite before logged in.`);
          res.status(404).send("Mentor not found.");
        }
    } catch (error) {
      console.error("Error fetching mentor profile:", error.message);
      res.status(500).send("Internal server error loading mentor profile.");
    } finally {
      if(client) {
        client.release();
      }
    }
  });


  app.get('/mentor-dashboard', requireMentorLogin, async(req, res) => {
    const mentorId = req.session.mentorId;  //Get the logged-in mentor's ID from session
    let client;

    console.log("Mentor Dashboard: Fetching data for mentorId:", mentorId);

    try {
      client = await pool.connect();

      // 1. Fetch mentor's basic profile details
      const mentorQuery = `
      SELECT fullname, email
      FROM Mentor
      WHERE mentor_id = $1::int;
      `;
      const mentorResult = await client.query(mentorQuery, [mentorId]);

      if(mentorResult.rows.length === 0) {
        console.error(`Mentor with ID ${mentorId} not found for dashboard.`);
        return res.status(404).send("Mentor profile not found");
      }
      const mentor = mentorResult.rows[0];
      console.log("Mentor Dashboard: Fetched mentor details:", mentor);

      // 2. Fetch sessions booked with this mentor
      const sessionsQuery = `
      SELECT
        s.start_time,
        s.end_time,
        s.feedback,
        s.session_status,
        u.fullname AS mentee_fullname,
        u.email AS mentee_email
      FROM sessions AS s
      JOIN users AS u ON s.user_id = u.user_id
      WHERE s.mentor_id = $1::int
      ORDER BY s.start_time DESC; --Order by start time, most recent first
      `;
      const sessionsResult = await client.query(sessionsQuery, [mentorId]);
      const sessions = sessionsResult.rows;
      console.log("Mentor Dashboard: Fetched sessions:", sessions);

      //Render the mentor-dashboard.hbs template with the fetched data
      res.render('mentor-dashboard', { mentor: mentor, sessions: sessions});

    } catch (error) {
      console.error("Error loading mentor dashboard:", error.message);
      res.status(500).send("Internal server error loading dashboard.");
    } finally {
      if(client) {
        client.release();
      }
    }
  });

  app.get('/mentee-dashboard', requireLogin, async (req, res) => {
    const userId = req.session.userId; //Get the logged-in user's ID from session
    let client;

    console.log("Mentee Dashboard: Fetching data for userId:", userId);

    try{
      client = await pool.connect();

      // 1. Fetch mentee's basic profile details
      const userQuery = `
      SELECT fullname, email
      FROM users
      WHERE user_id = $1::int;
      `;
      const userResult = await client.query(userQuery, [userId]);

      if(userResult.rows.length === 0) {
        console.error(`User with ID ${userId} not found for dashboard.`);
        return res.status(404).send("User profile not found.");
      }
      const user = userResult.rows[0];
      console.log("Mentee Dashboard: Fetched user details:", user); // Log user details

      // 2. Fetch sessions booked by this mentee
      const sessionsQuery = `
      SELECT
        s.start_time,
        s.end_time,
        s.feedback,
        s.session_status,
        m.fullname AS mentor_fullname,
        m.email AS mentor_email
      FROM sessions AS s
      JOIN Mentor AS m ON s.mentor_id = m.mentor_id
      WHERE s.user_id = $1::int
      ORDER BY s.start_time DESC; -- Order by start time, most recent first
      `;
      const sessionsResult = await client.query(sessionsQuery, [userId]);
      const sessions = sessionsResult.rows;
      console.log("Mentee Dashboard: Fetched sessions:", sessions); // Log fetched sessions

      //Render the mentee-dashboard.hbs template with the fetched data
      res.render('mentee-dashboard', { user: user, sessions: sessions });

    } catch (error) {
      console.error("Error loading mentee dashboard:", error.message);
      res.status(500).send("Internal server error loading dashboard.");
    } finally {
      if(client) {
        client.release();
      }
    }
  });

app.listen(port, () => {
  console.log(`Example app listening on port http://localhost:${port}`)
})
