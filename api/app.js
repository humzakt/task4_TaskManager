const express = require("express");
const app = express();
const mongoose = require("./db/mongoose");
const bodyParser = require("body-parser");
const { List, Task, User } = require("./db/models");
const jwt = require("jsonwebtoken");
const cors = require("cors");
//load middleware

app.use(bodyParser.json());

let authenticate = (req, res, next) => {
  let token = req.header("x-access-token");

  jwt.verify(token, User.getJWTSecret(), (err, decoded) => {
    if (err) {
      //there was an error
      //jwt is invalid - DO NOT AUTHENTICATE
      res.status(401).send(err);
    } else {
      //jwt is valid
      req.user_id = decoded._id;
      next();
    }
  });
};

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

      // console.log("user", user);
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

app.use(
  cors({
    credentials: true,
    exposedHeaders: ["x-access-token", "x-refresh-token", "_id"],
  })
);

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

app.get("/lists", authenticate, (req, res) => {
  //return lists from db

  List.find({
    _userId: req.user_id,
  })
    .then((lists) => {
      res.send(lists);
    })
    .catch((e) => {
      console.log("error in app get lists", e);
      res.send(e);
    });
});

/**
 * Post /lists
 * Purpose: Create a list
 *
 */
app.post("/lists", authenticate, (req, res) => {
  let title = req.body.title;
  let newList = new List({
    title,
    _userId: req.user_id,
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

app.patch("/lists/:id", authenticate, (req, res) => {
  // Update the specified list with the new values in the request body

  List.findOneAndUpdate(
    { _id: req.params.id, _userId: req.user_id },
    {
      $set: req.body,
    }
  )
    .then(() => {
      res.send({ message: "Updated successfully" });
    })
    .catch((e) => {
      res.send(e);
    });
});

/**
 * Delete /lists/:id
 * Purpose: Delete a specified list
 */

app.delete("/lists/:id", authenticate, (req, res) => {
  // Delete the specified list
  List.findByIdAndRemove({ _id: req.params.id, _userId: req.user_id })
    .then((removedListDoc) => {
      res.send(removedListDoc);

      //delete all tasks that are in the deleted list

      deleteTasksFromList(removedListDoc);
    })
    .catch((e) => {
      res.send(e);
    });
});

/**
 * Get /lists/:listId/tasks
 * Purpose: Send all tasks in a specified list
 */

app.get("/lists/:listId/tasks", authenticate, (req, res) => {
  //return all tasks that belong to a specific list
  Task.find({
    _listId: req.params.listId,
  })
    .then((tasks) => {
      res.send(tasks);
    })
    .catch((e) => {
      res.send(e);
    });
});

/**
 * Get /lists/:listId/tasks/:taskId
 * Purpose: Send a specific task in a list
 */

app.get("/lists/:listId/tasks/:taskId", authenticate, (req, res) => {
  List.findOne({
    _id: req.params.listId,
    _userId: req.user_id,
  })
    .then((list) => {
      // console.log(req.user_id);
      // console.log(req.params.listId);

      if (list) {
        //list is found
        return true;
      } else {
        //list is undefined
        return false;
      }
    })
    .then((canViewSpecificTask) => {
      // console.log("canCreateTask", canCreateTask);
      if (canViewSpecificTask) {
        //return a specified task in a list
        Task.findOne({
          _listId: req.params.listId,
          _id: req.params.taskId,
        }).then((task) => {
          res.send(task);
        });
      } else {
        res.sendStatus(404);
      }
    });
});

/**
 * Post /lists/:listId/tasks
 * Purpose: Send all tasks in a specified list
 */

app.post("/lists/:listId/tasks", authenticate, (req, res) => {
  List.findOne({
    _id: req.params.listId,
    _userId: req.user_id,
  })
    .then((list) => {
      // console.log(req.user_id);
      // console.log(req.params.listId);

      if (list) {
        //list is found
        return true;
      } else {
        //list is undefined
        return false;
      }
    })
    .then((canCreateTask) => {
      // console.log("canCreateTask", canCreateTask);
      if (canCreateTask) {
        //create a new task in a list specified by listId
        let newTask = new Task({
          title: req.body.title,
          _listId: req.params.listId,
        });
        newTask.save().then((newTaskDoc) => {
          res.send(newTaskDoc);
        });
      } else {
        res.sendStatus(404);
      }
    });
});

/**
 * Patch /lists/:listId/tasks/:taskId
 * Purpose: Update task in a specified list
 */

app.patch("/lists/:listId/tasks/:taskId", authenticate, (req, res) => {
  List.findOne({
    _id: req.params.listId,
    _userId: req.user_id,
  })
    .then((list) => {
      // console.log(req.user_id);
      // console.log(req.params.listId);

      if (list) {
        //list is found
        return true;
      } else {
        //list is undefined
        return false;
      }
    })
    .then((canEditTask) => {
      // console.log("canCreateTask", canCreateTask);
      if (canEditTask) {
        //edit task title in the specified title
        Task.findOneAndUpdate(
          { _listId: req.params.listId, _id: req.params.taskId },
          {
            $set: req.body,
          }
        ).then(() => {
          res.send({ message: "Updated successfully" });
        });
      } else {
        res.sendStatus(404);
      }
    });
});

/**
 * Delete /lists/:listId/tasks/:taskId
 * Purpose: Delete task in a specified list
 */

app.delete("/lists/:listId/tasks/:taskId", authenticate, (req, res) => {
  List.findOne({
    _id: req.params.listId,
    _userId: req.user_id,
  })
    .then((list) => {
      // console.log(req.user_id);
      // console.log(req.params.listId);

      if (list) {
        //list is found
        return true;
      } else {
        //list is undefined
        return false;
      }
    })
    .then((canDeleteTask) => {
      // console.log("canCreateTask", canCreateTask);
      if (canDeleteTask) {
        //edit task title in the specified title
        Task.findOneAndRemove({
          _id: req.params.taskId,
          _listId: req.params.listId,
        }).then((removedTaskDoc) => {
          res.send(removedTaskDoc);
        });
      } else {
        res.sendStatus(404);
      }
    });

  //delete a new task in a list specified by listId
});

//User routes

/**
 * Post /users
 * Purpose : Sign up
 */

app.post("/users", (req, res) => {
  let body = req.body;
  let newUser = new User({
    email: body.email,
    password: body.password,
    isOwner: true,
  });

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

  User.findByCredentials(email, password)
    .then((user) => {
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
              // .header("isOwner", user.isOwner)
              .send(user);
            // console.log(res);
          })
          .catch((e) => {
            res
              .status(400)
              .send({ message: "Unable to generate access token\n", e });
          });
      });
    })
    .catch((e) => {
      res.status(401).send({ message: "Unable to login\n", e });
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
      // console.log("Access token generated successfully");
      res.body = accessToken;
      res.header("x-access-token", accessToken).send({ accessToken });
    })
    .catch((e) => {
      res.status(400).send(e);
    });
});

//Method to create sub users in a team

app.post("/users/create-sub-user", authenticate, (req, res) => {
  let body = req.body;
  let email = body.email;
  let password = body.password;

  let user = new User({
    email,
    password,
    isOwner: false,
    _ownerId: req.user_id,
  });

  // newUser
  //   .save()
  //   .then(() => {
  //     return newUser.createSession();
  //   })
  user
    .save()
    .then(() => {
      res.send(user);
    })
    .catch((e) => {
      res.status(400).send(e);
    });
});

//Get list of sub users
app.get("/users/sub-users", authenticate, (req, res) => {
  User.find({
    _ownerId: req.user_id,
  })
    .then((subUsers) => {
      res.send(subUsers);
    })
    .catch((e) => {
      res.send(e);
    });
});

//delete sub user
app.delete("/users/sub-users/:userId", authenticate, (req, res) => {
  User.findOneAndDelete({
    _id: req.params.userId,
    _ownerId: req.user_id,
  })
    .then((subUser) => {
      deleteTasksFromSubUser(subUser._id);
      res.send(subUser);
    })
    .catch((e) => {
      res.send(e);
    });
});

//*****************************************************************************/
//*****************************************************************************/
//***********************  Tasks in SubUser  **********************************/
//*****************************************************************************/
//*****************************************************************************/

/**
 * Get /user/:userId/tasks
 * Purpose: Send all tasks in a specified sub user
 */

app.get("/users/:userId/tasks", authenticate, (req, res) => {
  //return all tasks that belong to a specific user
  Task.find({
    _userId: req.params.userId,
  })
    .then((tasks) => {
      res.send(tasks);
    })
    .catch((e) => {
      res.send(e);
    });
});

/**
 * Post /users/:userId/tasks
 * Purpose: create task in a specified sub user
 */

app.post("/users/:userId/tasks", authenticate, (req, res) => {
  User.findOne({
    _id: req.params.userId,
    // _userId: req.user_id,
  })
    .then((user) => {
      // if user exists
      //

      if (user) {
        //user is found
        return true;
      } else {
        return false;
      }
    })
    .then((canCreateTask) => {
      // console.log("canCreateTask", canCreateTask);
      if (canCreateTask) {
        //create a new task in a user specified by userId
        let newTask = new Task({
          title: req.body.title,
          _userId: req.params.userId,
        });
        newTask.save().then((newTaskDoc) => {
          res.send(newTaskDoc);
        });
      } else {
        res.sendStatus(404);
      }
    });
});

/**
 * Patch "/users/:userId/tasks/:taskId"
 * Purpose: Update task in a specified user
 */

app.patch("/users/:userId/tasks/:taskId", authenticate, (req, res) => {
  User.findOne({
    _id: req.params.userId,
    // _userId: req.user_id,
  })
    .then((user) => {
      // if user exists
      //

      if (user) {
        //user is found
        return true;
      } else {
        return false;
      }
    })
    .then((canEditTask) => {
      // console.log("canCreateTask", canCreateTask);
      if (canEditTask) {
        //edit a task in a user specified by userId

        Task.findOneAndUpdate(
          {
            _id: req.params.taskId,
            _userId: req.params.userId,
          },
          {
            $set: req.body,
          }
        ).then(() => {
          res.send({ message: "Updated successfully" });
        });
      } else {
        res.sendStatus(404);
      }
    })
    .catch((e) => {
      res.send(e);
    });
});

/**
 * Delete "/users/:userId/tasks/:taskId"
 * Purpose: Delete task in a specified user
 */

app.delete("/users/:userId/tasks/:taskId", authenticate, (req, res) => {
  User.findOne({
    _id: req.params.userId,
    // _userId: req.user_id,
  })
    .then((user) => {
      // if user exists
      //

      if (user) {
        //user is found
        return true;
      } else {
        return false;
      }
    })
    .then((canDeleteTask) => {
      // console.log("canCreateTask", canCreateTask);
      if (canDeleteTask) {
        //edit a task in a user specified by userId

        Task.findOneAndDelete(
          {
            _id: req.params.taskId,
            _userId: req.params.userId,
          },
          {
            $set: req.body,
          }
        ).then((task) => {
          res.send(task);
        });
      } else {
        res.sendStatus(404);
      }
    })
    .catch((e) => {
      res.send(e);
    });
});

//*****************************************************************************/
//*************************    END    *****************************************/
//*****************************************************************************/

//Helper methods

let deleteTasksFromSubUser = (_userId) => {
  Task.deleteMany({
    _userId,
  }).then(() => {
    console.log("Tasks from " + _userId._id + " were deleted!");
  });
};

let deleteTasksFromList = (_listId) => {
  Task.deleteMany({
    _listId,
  }).then(() => {
    console.log("Tasks from " + _listId._id + " were deleted!");
  });
};

app.listen(3000, () => {
  console.log("Task Manager listening on port 3000!");
});
