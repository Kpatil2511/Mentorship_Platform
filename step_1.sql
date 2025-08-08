DROP TABLE IF exists users cascade;
drop table if exists Mentor cascade;
drop type if exists session_status_enum cascade;
drop table if exists Mentor_profile;
drop table if exists sessions cascade;

SELECT 'Your first SQL file ran successfully!';
CREATE TABLE users (
    fullname varchar(255),
    email varchar(255),
    user_id int not null primary key,
    password varchar(255),
    created_at timestamptz DEFAULT NOW()

 );


Create table Mentor (
    Mentor_Id int not null primary key,
    fullName Varchar(255),
    email varchar(255),
    bio varchar(255),
    password varchar(255),
    created_at timestamptz DEFAULT NOW(),
    updated_at timestamptz DEFAULT NOW()
    );

Create table Mentor_profile (
    Mentor_Id int,
    foreign key(Mentor_Id) references Mentor(Mentor_Id),
    designation varchar(255),
    company varchar(255),
    location varchar(255),
    timezone timestamptz DEFAULT NOW(),
    linkedin_url varchar(255)

 );

CREATE TYPE session_status_enum AS ENUM ('scheduled', 'completed', 'cancelled');

Create table sessions(
    User_Id int,
    Mentor_Id int,
    session_id varchar(255) primary key,
    foreign key(User_Id) references users(User_Id),
    foreign key(Mentor_Id) references Mentor(Mentor_Id),
    start_time timestamp,
    end_time timestamp,
    session_status session_status_enum,
    feedback varchar(255)
 );

ALTER TABLE Mentor_profile ADD COLUMN image Varchar(255);

CREATE TABLE mentor_availability (
    id SERIAL PRIMARY KEY,
    mentor_id INT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_booked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mentor_id) REFERENCES Mentor(Mentor_Id) ON DELETE CASCADE
);

