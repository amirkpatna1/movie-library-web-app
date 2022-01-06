//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");
const jwt = require("jsonwebtoken");
const request = require("request");
const axios = require("axios");

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

app.use(
  session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect(process.env.DB, {
  useNewUrlParser: true,
});
mongoose.set("useCreateIndex", true);

const publicPlayListSchema = new mongoose.Schema({
  name: String,
});

const playListSchema = new mongoose.Schema({
  _id: String,
  movies: [String],
});

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String,
  playLists: [playListSchema],
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const PlayList = new mongoose.model("PlayList", playListSchema);

const User = new mongoose.model("User", userSchema);

const PublicPlayList = new mongoose.model(
  "PublicPlayList",
  publicPlayListSchema
);

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
  done(null, user.id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    done(err, user);
  });
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/search",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    function (accessToken, refreshToken, profile, cb) {
      console.log(profile);

      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

app.get("/", function (req, res) {
  res.render("home");
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);

app.get(
  "/auth/google/search",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect("/secrets");
  }
);

app.get("/login", function (req, res) {
  res.render("login");
});

app.get("/register", function (req, res) {
  res.render("register");
});




app.post("/add", function (req, res) {
  if (req.isAuthenticated()) {
    var flag = 1;
    const playListName = req.body;
    // console.log(playListName);
    if(playListName.playlist=="Public" || playListName.playlist=="" || playListName.playlist==null) {
      flag=0;
    }
    PlayList.findById(playListName,function (err, playList) {
      if(playList) {
        flag=0;
      }
    });
    User.findById(req.user.id, function (err, foundUser) {
      
      foundUser.playLists.forEach((element) => {
        if (element._id == playListName.playlist) {
          // alert('playlist already exists');
          flag = 0;
        }
      });
      if (flag) {
        var newPlayList = new PlayList({
          _id: playListName.playlist,
          movies: [],
        });
        newPlayList.save();
        foundUser.playLists.push(newPlayList);
        foundUser.save();
      }
    });
    res.redirect("/homepage");
  } else {
    res.redirect("/login");
  }
});

app.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
});

app.get("/homepage", function (req, res) {
  if (req.isAuthenticated()) {
    var ids = ["Public"];
    User.findById(req.user.id, function (err, user) {
      if (user) {
        user.playLists.forEach((element) => {
          // console.log(element._id);
          ids.push(element._id);
        });
        // console.log(ids);
        res.render("homepage", { ids: ids });
      }
    });
  } else {
    res.redirect("/");
  }
});

app.post("/search", function (req, res) {
  var { search } = req.body;
  if (req.isAuthenticated()) {
    // console.log(search);
    request(
      "http://www.omdbapi.com/?apikey=fe8ce25c&t=" + search,
      function (error, response, body) {
        if (error) {
          console.log(error);
        } else {
          var data = [];
          data.push(JSON.parse(body));
          // console.log(data);
          var playlists = ["Public"];
          User.findById(req.user.id, function (err, user) {
            user.playLists.forEach((element) => {
              playlists.push(element._id);
            });
            res.render("cards", {
              search: search,
              data: data,
              playlists: playlists,
            });
          });
        }
      }
    );
  }
  else res.redirect('/login');

  // res.render('cards');
});

app.get('/playlist/:token',function(req,res){
  let token=req.params.token;
  let arr=token.split(':');
  console.log(arr[1]);
  if(arr[1]==="Public"){
    const newMovie=new PublicPlayList({name:arr[0]});
    console.log(newMovie);
    console.log("working");
    newMovie.save();
  }
  else{
    PlayList.findById(arr[1],function(err,playlist){
      if(playlist){
        // console.log(playlist);
        playlist.movies.push(arr[0]);
        playlist.save();
      }
    });
  }
  res.redirect('/homepage');
});


async function getData(req,res){
  let token =req.params.token;
  var movies=[];
  var movie=[];
  if(token=="Public"){
      const publicplaylist=await PublicPlayList.find({});
      for(const element of publicplaylist){
        movie.push(element.name);
      }
      for(const element of movie){
        const response=await axios.get("http://www.omdbapi.com/?apikey=fe8ce25c&t="+element);
        movies.push(response.data);
      }
      res.render('playlistCard',{data:movies});
  }
    else if(req.isAuthenticated()){
      const playlist=await PlayList.findById(token);
      playlist.movies.forEach(element => {
        movie.push(element);
        // console.log(element);
      });
      for(const element of movie){
        const response=await axios.get("http://www.omdbapi.com/?apikey=fe8ce25c&t="+element);
        movies.push(response.data);
      }
      // console.log(movies);
      res.render('playlistCard',{data:movies});
    }
    else res.redirect('/login');
  
}


app.get('/show/:token',getData);


app.get('/show/readmore/:token',function(req,res){
  if(req.isAuthenticated()){
    let token =req.params.token;
    axios.get("http://www.omdbapi.com/?apikey=fe8ce25c&plot=full&t="+token).then(function(response){
      // console.log(response.data);
      res.render('landing',{data:response.data});
    });
  }
  else res.redirect('/login');
});


app.get('/public/playlist',function(req, res){

});


app.post("/register", function (req, res) {
  User.register(
    { username: req.body.username },
    req.body.password,
    function (err, user) {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function () {
          res.redirect("/homepage");
        });
      }
    }
  );
});

app.post("/login", function (req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });

  req.login(user, function (err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function () {
        res.redirect("/homepage");
      });
    }
  });
});

app.listen(process.env.PORT || 3000, function () {
  console.log("Server started on port 3000.");
});
