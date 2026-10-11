require("dotenv/config")
const express = require("express")

const auth = require("./routes/auth").default
const tasks = require("./routes/tasks").default

const authMiddleware = require("./middleware/auth").default

const app = express()

app.use(express.json())

app.use("/auth", auth)
app.use(authMiddleware)
app.use("/tasks", tasks)

const port = process.env.PORT ?? 3000

app.listen(port, () => {
    console.log("Listening to port", port)
})