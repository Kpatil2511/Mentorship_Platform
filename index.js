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
  if (req.session.userId === undefined || req.session.userId === null) {
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

function parseDateTime(dateTimeString) {
  if(!dateTimeString) return null;
  // Assuming input is in local time and converting to UTC for TIMESTAMPTZ storage
  // Ensure the client-side datetime-local input sends values in a format that JS Date can parse
  // e.g., "YYYY-MM-DDTHH:MM"
  const date = new Date(dateTimeString);
  if (isNaN(date.getTime())) {
    return null; // Invalid date
  }
  return date.toISOString(); // Convert to ISO 8601 string (UTC)
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
    console.log("Backend: Recieved book-session POST request.");
    const { mentor_id, availability_id, mentee_email, feedback} = req.body;
    let client;

    // Basic validation
    if (!mentor_id || !availability_id || !mentee_email) {
      console.error("Backend: Validation failed - Missing mentor_id, availability_id, or mentee_email.");
      return res.status(400).json({ error: "Mentor ID, Availability ID, and your email are required." });
    }

    try {
      client = await pool.connect();
      await client.query('BEGIN'); // Start a transaction

      // 1. Get mentee's user_id from email
      const userResult = await client.query(
        'SELECT user_id FROM users WHERE email = $1',
        [mentee_email]
      );
      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        console.error("Backend: Mentee email not found:", mentee_email);
        return res.status(404).json({ error: "Your email is not registered as a user." });
      }
      const userId = userResult.rows[0].user_id;

      // 2. Fetch the availability slot and validate it
      const availabilityQuery = `
        SELECT start_time, end_time, is_booked
        FROM mentor_availability
        WHERE id = $1::int AND mentor_id = $2::int FOR UPDATE; -- FOR UPDATE locks the row
        `;
        const availabilityResult = await client.query(availabilityQuery, [availability_id, mentor_id]);

        if (availabilityResult.rows.length === 0) {
          await client.query('ROLLBACK');
          console.error(`Backend: Availability slot ${availability_id} not found for mentor ${mentor_id}.`);
          return res.status(404).json({ error: "Selected availability slot not found for this mentor."});
        }

        const selectedSlot = availabilityResult.rows[0];

        if (selectedSlot.is_booked) {
          await client.query('ROLLBACK');
          console.error(`Backend: Availability slot ${availability_id} is already booked.`);
          return res.status(409).json({ error: "This slot is already booked. Please choose another." });
        }

        // Ensure the slot is not in the past (using server's current time)
        const now = new Date();
        if (new Date(selectedSlot.start_time) < now) {
          await client.query('ROLLBACK');
          console.error(`Backend: Attempted to book a past slot: ${selectedSlot.start_time}`);
          return res.status(400).json({ error: "Cannot book a session in the past. Please select a future slot." });
        }

        // 3. Insert into sessions table
        const session_id = uuidv4();
        const insertSessionQuery = `
          INSERT INTO sessions (session_id, user_id, mentor_id, start_time, end_time, feedback, session_status)
          VALUES ($1, $2, $3::int, $4, $5, $6, $7) RETURNING session_id;
          `;
          await client.query(insertSessionQuery, [
            session_id,
            userId,
            mentor_id,
            selectedSlot.start_time, // Use times from the availability slot
            selectedSlot.end_time,
            feedback,
            'scheduled'
          ]);

          // 4. Update the availability slot to is_booked = true
          const updateAvailabilityQuery = `
            UPDATE mentor_availability
            SET is_booked = TRUE
            WHERE id = $1::int AND mentor_id = $2::int;
            `;
            await client.query(updateAvailabilityQuery, [availability_id, mentor_id]);

            await client.query('COMMIT'); //Commit the transaction
            console.log(`Backend: Session booked successfully for availability_id ${availability_id}, session_id ${session_id}.`);
            res.status(200).json({ message: "Session booked successfully!", session_id });
    } catch (err) {
      if (client) {
        await client.query('ROLLBACK'); // Rollback on error
      }
      console.error("Backend: Error booking session:", err.message);
      res.status(500).json({ error: "Failed to book session.", details: err.message });
    } finally {
      if (client) {
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

  // NEW: API to add mentor availability
  app.post('/api/mentor/availability', requireMentorLogin, async (req, res) => {
    const mentorId = req.session.mentorId;
    const { start_time, end_time } = req.body;
    let client;

    // ---- DEBUGGING START ----
    console.log("Backend: Received availability POST request.");
    console.log(" mentorId from session:", mentorId);
    console.log(" Raw start_time from req.body:", start_time);
    console.log(" Raw end_time from req.body", end_time);

    // Validate input
    if (!start_time || !end_time) {
      return res.status(400).json({ error: "Start time and end time are required. " });
    }

    const parsedStartTime = parseDateTime(start_time);
    const parsedEndTime = parseDateTime(end_time);

    console.log("Backend: Parsed start_time:", parsedStartTime);
    console.log("Backend: Parsed end_time:", parsedEndTime);

    if (!parsedStartTime || !parsedEndTime) {
      return res.status(400).json({ error: "Invalid date/time format. "});
    }

    // Basic validation: ensure end time is after start time
    if (new Date(parsedStartTime) >= new Date(parsedEndTime)) {
      return res.status(400).json({ error: "End time must be after start time. "});
    }

    try {
      client = await pool.connect();
      const query = `
      INSERT INTO mentor_availability (mentor_id, start_time, end_time)
      VALUES ($1, $2, $3)
      RETURNING id, start_time, end_time, is_booked;
      `;
      const result = await client.query(query, [mentorId, parsedStartTime, parsedEndTime]);
      res.status(201).json({ success: true, message: "Availability added successfully!", slot: result.rows[0] });
    } catch (error) {
      console.error("Error adding mentor availability:", error.message);
      res.status(500).json({ error: "Failed to add availability.", details: error.message });
    } finally {
      if (client) {
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

  app.get('/logout', (req, res) => {
    req.session.destroy(err => {
      if (err) {
        console.error("Error destroying session:", err);
        return res.status(500).send("Could not log out.");
      }
      console.log("Session destroyed. User logged out.");
      res.redirect('/'); // Redirect to homepage after logout
    });
  });

  // NEW: API to get mentor availability
  app.get('/api/mentor/availability', requireMentorLogin, async (req, res) => {
    const mentorId = req.session.mentorId;
    let client;

    try {
      client = await pool.connect();
      const query = `
      SELECT id, start_time, end_time, is_booked
      FROM mentor_availability
      WHERE mentor_id = $1::int
      ORDER BY start_time ASC;
      `;
      const result = await client.query(query, [mentorId]);
      res.status(200).json({ success: true, availability: result.rows });

    } catch (error) {
      console.error("Error fetching mentor availability:", error.message);
      res.status(500).json({ error: "Failed to fetch availability.", details: error.message});
    } finally {
      if(client) {
        client.release();
      }
    }
  });

  app.get('/api/public/mentor-availability/:mentor_id', async (req, res) => {
    const { mentor_id } = req.params;
    let client;

    try {
      client = await pool.connect();
      const query = `
        SELECT id, start_time, end_time, is_booked
        FROM mentor_availability
        WHERE mentor_id = $1::int AND is_booked = FALSE AND start_time > NOW()
        ORDER BY start_time ASC;
        `;
        const result = await client.query(query, [mentor_id]);
        res.status(200).json({ success: true, availability: result.rows });
    } catch (error) {
      console.error("Error fetching public mentor availability:", error.message);
      res.status(500).json({ error: "Failed to fetch public availability.", details: error.message });
    } finally {
      if(client) {
        client.release();
      }
    }
  });

  app.delete('/api/mentor/availability/:id', requireMentorLogin, async (req, res) => {
    const mentorId = req.session.mentorId;
    const availabilityId = req.params.id; // The ID of the availability slot to delete
    let client;

    try {
      client = await pool.connect();

      // First, check if the slot exists and is not booked, and belongs to the mentor
      const checkQuery = `
        SELECT is_booked FROM mentor_availability
        WHERE id = $1::int AND mentor_id = $2::int;
        `;
        const checkResult = await client.query(checkQuery, [availabilityId, mentorId]);

        if (checkResult.rows.length === 0) {
          return res.status(404).json({ success: false, message: "Availability slot not found and does not belong to you."})
        }
        if (checkResult.rows[0].is_booked) {
          return res.status(400).json({ success: false, message: "Cannot delete a booked availability slot."});
        }
      // Ensure the slot belongs to the logged-in mentor before deleting
      const deleteQuery = `
      DELETE FROM mentor_availability
      WHERE id = $1::int AND mentor_id = $2::int
      RETURNING id;
      `;
      const result = await client.query(deleteQuery, [availabilityId, mentorId]);

      if (result.rowCount > 0) {
        res.status(200).json({ success: true, message: "Availability slot deleted successfully." });
      } else {
        res.status(404).json({ success: false, message: "Availability slot not found or does not belong to you." });
      }
    } catch (error) {
      console.error("Error deleting mentor availability:", error.message);
      res.status(500).json({ error: "Failed to delete availability.", details: error.message });
    } finally {
      if (client) {
        client.release()
      }
    }
  });

app.listen(port, () => {
  console.log(`Example app listening on port http://localhost:${port}`)
})
