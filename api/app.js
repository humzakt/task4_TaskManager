const express = require("express");
const app = express();
const mongoose = require("./db/mongoose");
const bodyParser = require("body-parser");
const { List, Task, User } = require("./db/models");

//load middleware

app.use(bodyParser.json());

//verify refresh token middleware (which will be added to the private routes)
let verifySession = (req, res, next) => {
  //grab the refresh token from the users cookies
  let refreshToken = req.header("x-refresh-token");
  let _id = req.header("_id");

  // console.log(req.headers);

  // console.log("refreshToken", refreshToken);
  // console.log("_id", _id);

  User.findbyIdAndToken(_id, refreshToken)
    .then((user) => {
      if (!user) {
        //if no user is found
        return Promise.reject({
          error:
            "User not found. Make sure that the refresh token and user id are correct",
        });
      }

      console.log("user", user);
      let isSessionValid = false;

      user.sessions.forEach((session) => {
        if (session.token === refreshToken) {
          //check if the session has expired
          if (User.hasRefreshTokenExpired(session.expiresAt) === false) {
            //refresh token has not expired
            isSessionValid = true;
          }
        }
      });

      if (isSessionValid) {
        //the session is valid, call next() to continue with processing this web request
        req.user_id = user._id;
        req.userObject = user;
        req.refreshToken = refreshToken;

        next();
      }
    })
    .catch((e) => {
      console.log(e);
      res.status(401).send(e);
    });
};

//CORS HEADERS MIDDLEWARE

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "http://localhost:4200"); // update to match the domain you will make the request from
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PATCH, PUT, DELETE, OPTIONS"
  );
  next();
});

/**
 * Route Handlers
 *
 */

/* Lists */

/**
 * GET /lists
 * Purpose: Get all lists
 *
 */

app.get("/lists", (req, res) => {
  //return lists from db

  List.find({}).then((lists) => {
    res.send(lists);
  });
});

/**
 * Post /lists
 * Purpose: Create a list
 *
 */
app.post("/lists", (req, res) => {
  let title = req.body.title;
  let newList = new List({
    title,
  });

  newList.save().then((listDoc) => {
    //return full list doc
    res.send(listDoc);
  });
});

/**
 * Patch /lists/:id
 * Purpose: Update a specified list
 */

app.patch("/lists/:id", (req, res) => {
  // Update the specified list with the new values in the request body

  List.findOneAndUpdate(
    { _id: req.params.id },
    {
      $set: req.body,
    }
  ).then(() => {
    res.send({ message: "Updated successfully" });
  });
});

/**
 * Delete /lists/:id
 * Purpose: Delete a specified list
 */

app.delete("/lists/:id", (req, res) => {
  // Delete the specified list
  List.findByIdAndRemove({ _id: req.params.id }).then((removedListDoc) => {
    res.send(removedListDoc);
  });
});

/**
 * Get /lists/:listId/tasks
 * Purpose: Send all tasks in a specified list
 */

app.get("/lists/:listId/tasks", (req, res) => {
  //return all tasks that belong to a specific list
  Task.find({
    _listId: req.params.listId,
  }).then((tasks) => {
    res.send(tasks);
  });
});

/**
 * Get /lists/:listId/tasks/:taskId
 * Purpose: Send a specific task in a list
 */

app.get("/lists/:listId/tasks/:taskId", (req, res) => {
  //return a specified task in a list
  Task.findOne({
    _listId: req.params.listId,
    _id: req.params.taskId,
  }).then((task) => {
    res.send(task);
  });
});

/**
 * Post /lists/:listId/tasks
 * Purpose: Send all tasks in a specified list
 */

app.post("/lists/:listId/tasks", (req, res) => {
  //create a new task in a list specified by listId
  let newTask = new Task({
    title: req.body.title,
    _listId: req.params.listId,
  });
  newTask.save().then((newTaskDoc) => {
    res.send(newTaskDoc);
  });
});

/**
 * Patch /lists/:listId/tasks/:taskId
 * Purpose: Update task in a specified list
 */

app.patch("/lists/:listId/tasks/:taskId", (req, res) => {
  //create a new task in a list specified by listId
  Task.findOneAndUpdate(
    { _listId: req.params.listId, _id: req.params.taskId },
    {
      $set: req.body,
    }
  ).then(() => {
    res.send({ message: "Updated successfully" });
  });
});

/**
 * Delete /lists/:listId/tasks/:taskId
 * Purpose: Delete task in a specified list
 */

app.delete("/lists/:listId/tasks/:taskId", (req, res) => {
  //create a new task in a list specified by listId
  Task.findOneAndRemove({
    _id: req.params.taskId,
    _listId: req.params.listId,
  }).then((removedTaskDoc) => {
    res.send(removedTaskDoc);
  });
});

//User routes

/**
 * Post /users
 * Purpose : Sign up
 */

app.post("/users", (req, res) => {
  let body = req.body;
  let newUser = new User(body);

  newUser
    .save()
    .then(() => {
      return newUser.createSession();
    })
    .then((refreshToken) => {
      //Session created successfully - refreshToken returned
      //now we generate an access auth token for the user

      return newUser.generateAccessAuthToken().then((accessToken) => {
        //access auth token generated successfully, now we return an object containing the auth tokens
        return { accessToken, refreshToken };
      });
    })
    .then((authTokens) => {
      //now we construct and send the response to the user with their auth tokens in the header and the user object in the body

      res
        .header("x-refresh-token", authTokens.refreshToken)
        .header("x-access-token", authTokens.accessToken)
        .send(newUser);
    })
    .catch((e) => {
      res.status(400).send(e);
    });
});

/**
 * Post /users/login
 * Purpose : login
 */

app.post("/users/login", (req, res) => {
  let email = req.body.email;
  let password = req.body.password;

  User.findByCredentials(email, password).then((user) => {
    return user.createSession().then((refreshToken) => {
      //Session created successfully - refreshToken returned
      //now we generate an access auth token for the user

      return user
        .generateAccessAuthToken()
        .then((accessToken) => {
          //access auth token generated successfully, now we return an object containing the auth tokens
          return { accessToken, refreshToken };
        })
        .then((authTokens) => {
          //now we construct and send the response to the user with their auth tokens in the header and the user object in the body

          res
            .header("x-refresh-token", authTokens.refreshToken)
            .header("x-access-token", authTokens.accessToken)
            .send(user);
        })
        .catch((e) => {
          res
            .status(400)
            .send({ message: "Unable to generate access token\n", e });
        });
    });
  });
});

/*
 *  GET /users/me/access-token
 *  Purpose: generates and returns an access token
 */

app.get("/users/me/access-token", verifySession, (req, res) => {
  //we know that the user is authenticated and we have the user_id and user object available to us

  req.userObject
    .generateAccessAuthToken()
    .then((accessToken) => {
      console.log("Access token generated successfully");
      res.body = accessToken;
      res.header("x-access-token", accessToken).send({ accessToken });
    })
    .catch((e) => {
      res.status(400).send(e);
    });
});

app.listen(3000, () => {
  console.log("Task Manager listening on port 3000!");
});
