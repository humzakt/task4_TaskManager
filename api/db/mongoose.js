const mongoose = require("mongoose");

//use global JS promise instead of bluebird promise
mongoose.Promise = global.Promise;
mongoose
  .connect("mongodb://localhost:27017/TaskManager", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((e) => {
    console.log("Error connecting to MongoDB");
    console.log(e);
  });

//prevent deprecation warnings

// mongoose.set("useCreateIndex", true);
// mongoose.set("useFindAndModify", false);

module.exports = {
  mongoose,
};
