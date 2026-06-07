require("dotenv/config")
const express = require("express")

const auth = require("./routes/auth").default
const tasks = require("./routes/tasks").default

const app = express()

app.use(express.json())

app.use("/auth", auth)
app.use("/tasks", tasks)

app.listen(process.env.PORT, () => {
    console.log("Listening to port", process.env.PORT)
})