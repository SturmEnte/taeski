const { Router } = require("express")

const db = require("../db").default

const router = Router()

const titleRegex = /^[a-zA-Z0-9\s\-_,\.;:()]+$/

// Get all tasks for the authenticated user
router.get("/", async (req, res) => {
    try {
        const tasks = await db`
            SELECT
                id,
                user_id,
                title,
                description,
                completed,
                start_date,
                due_date
            FROM tasks
            WHERE user_id = ${req.user.id}
            ORDER BY due_date NULLS LAST, start_date NULLS LAST
        `

        res.json(tasks)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Error while fetching tasks" })
    }
})

// Get a specific task by id for the authenticated user
router.get("/:id", async (req, res) => {
    if(req.params.id == undefined) {
        res.status(400).json({error: "Task id required"})
        return
    }

    try {
        const tasks = await db`
            SELECT
                id,
                user_id,
                title,
                description,
                completed,
                start_date,
                due_date
            FROM tasks
            WHERE user_id = ${req.user.id} AND id = ${req.params.id}
            ORDER BY due_date NULLS LAST, start_date NULLS LAST
        `

        if(tasks.length === 0) {
            res.status(404).json({ error: "Task not found" })
            return
        }

        res.json(tasks[0])
    } catch (err) {

        if(err.code === "22P02") { // Invalid UUID format
            res.status(400).json({ error: "Invalid task ID format" })
            return
        }

        console.error(err)
        res.status(500).json({ error: "Error while fetching tasks. Did you provide a valid task ID?" })
    }
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
    if(req.params.id == undefined) {
        res.status(400).json({error: "Task id required"})
        return
    }

    try {
        const deleted = await db`
            DELETE FROM tasks
            WHERE user_id = ${req.user.id} AND id = ${req.params.id}
            RETURNING id
        `

        if(deleted == undefined || deleted.length === 0) {
            res.status(404).json({ error: "Task not found" })
            return
        }

        res.sendStatus(204)
    } catch (err) {
        if(err.code === "22P02") { // Invalid UUID format
            res.status(400).json({ error: "Invalid task ID format" })
            return
        }

        console.error(err)
        res.status(500).json({ error: "Error while deleting task" })
    }
    
})

exports.default = router