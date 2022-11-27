const express = require("express");
const app = express();
const mongoose = require("./db/mongoose");
const bodyParser = require("body-parser");
const { List, Task } = require("./db/models");

//load middleware

app.use(bodyParser.json());

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

app.listen(3000, () => {
  console.log("Task Manager listening on port 3000!");
});
