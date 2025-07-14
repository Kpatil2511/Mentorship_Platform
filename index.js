const express = require('express')
const path = require('path')
const app = express()
app.use(express.json());
app.use(express.urlencoded({ extended: true}))
const pool = require('./db')
const port = 3000

app.use(express.static(path.join(__dirname,"public")))


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

  app.post('/api/create-mentor', async(req,res) => {
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

    const { fullname, email, password, Mentor_Id, bio, designation, company, location, linkedin_url} = data;

    const client = await pool.connect();

    try {
      await client.query('BEGIN')

      const mentorInsert = await client.query(
        'INSERT INTO Mentor (fullname, email, bio, password, Mentor_Id) VALUES ($1, $2, $3, $4, $5) RETURNING MENTOR_Id',
        [fullname, email, bio, password, Mentor_Id]
      );

      const mentorId = mentorInsert.rows[0].mentor_id;

      await client.query(
        'INSERT INTO Mentor_profile (mentor_id, designation, company, location, linkedin_url) VALUES ($1, $2, $3, $4, $5)',
        [mentorId, designation, company, location, linkedin_url]
      );

      await client.query('COMMIT');
      res.status(200).json({ message: 'Mentor created successfully'});
  } catch(err) {
    await client.query('ROLLBACK');
    console.error('Error inserting mentor and profile', err);
    res.status(500).json({error: 'Failed to create Mentor'});
  } finally {
    client.release(); //always release the client back to the pool
  }

   
  })

  app.get('/api/mentors', async(req,res) => {

    try{
    
    const fetch = await pool.query(
      `SELECT M.fullname, p.designation, p.company, p.bio
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

app.listen(port, () => {
  console.log(`Example app listening on port http://localhost:${port}`)
})
