const { Router } = require("express")

const db = require("../db").default

const router = Router()

const titleRegex = /^[a-zA-Z0-9\s\-_,\.;:()]+$/

// Get all tasks for the authenticated user
router.get("/", async (req, res) => {
    res.sendStatus(501) // Not implemented
})

// Get a specific task by id for the authenticated user
router.get("/:id", async (req, res) => {
    res.sendStatus(501) // Not implemented
})

// Create a new task for the authenticated user
router.post("/", async (req, res) => {

    if(req.body == undefined || req.body.title == undefined) {
        res.status(400).json({error: "Title required"})
        return
    }

    const title = req.body.title
    const description = req.body.description
    const completed = req.body.completed
    const startDate = req.body.start_date
    const dueDate = req.body.due_date

    // Remove leading and trailing whitespace from title and convert to string
    const normalizedTitle = title.toString().trim()

    // Check tasks title for characters with regex (only allow letters, numbers, spaces and some punctuation)
    if(!titleRegex.test(normalizedTitle)) {
        res.status(400).json({error: "Invalid title"})
        return
    }

    const createdTasks = await db`
        INSERT INTO tasks
            (user_id, title, description, completed, start_date, due_date)
        VALUES
            (
                ${req.user.id},
                ${normalizedTitle},
                ${description ?? null},
                ${completed ?? false},
                ${startDate ?? null},
                ${dueDate ?? null}
            )
        RETURNING
            id,
            user_id,
            title,
            description,
            completed,
            start_date,
            due_date
    `

    if(createdTasks == undefined || createdTasks.length == 0) {
        res.status(500).json({error: "Error while creating task"})
        return
    }

    res.status(201).json(createdTasks[0])
})

// Update a task by id for the authenticated user
router.put("/:id", async (req, res) => {
    res.sendStatus(501) // Not implemented
})

// Delete a task by id for the authenticated user
router.delete("/:id", async (req, res) => {
    res.sendStatus(501) // Not implemented
})

exports.default = router