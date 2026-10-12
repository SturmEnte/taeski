const { Router } = require("express")

const db = require("../db").default

const router = Router()

const priorities = [1, 2, 3, 4]
const recurrences = ["none", "daily", "weekly", "monthly", "yearly"]

function isValidDate(value) {
    if(value == null) return true
    if(typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
    const parsed = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

function addInterval(value, recurrence) {
    if(!value) return null
    const [year, month, day] = value.slice(0, 10).split("-").map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))

    if(recurrence === "daily") date.setUTCDate(date.getUTCDate() + 1)
    if(recurrence === "weekly") date.setUTCDate(date.getUTCDate() + 7)
    if(recurrence === "monthly") {
        const targetDay = date.getUTCDate()
        date.setUTCDate(1)
        date.setUTCMonth(date.getUTCMonth() + 1)
        date.setUTCDate(Math.min(targetDay, new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()))
    }
    if(recurrence === "yearly") date.setUTCFullYear(date.getUTCFullYear() + 1)

    return date.toISOString().slice(0, 10)
}

function validateTask(body) {
    if(typeof body.title !== "string" || !body.title.trim() || body.title.trim().length > 255) {
        return "A title of up to 255 characters is required"
    }
    if(body.description != null && typeof body.description !== "string") return "Description must be text"
    if(body.completed != null && typeof body.completed !== "boolean") return "Completed must be a boolean"
    if(body.priority != null && !priorities.includes(Number(body.priority))) return "Priority must be between 1 and 4"
    if(body.recurrence != null && !recurrences.includes(body.recurrence)) return "Invalid recurrence"
    if(!isValidDate(body.start_date) || !isValidDate(body.due_date) || !isValidDate(body.repeat_until)) return "Dates must use YYYY-MM-DD format"
    if(body.start_date && body.due_date && body.start_date > body.due_date) return "End date must be on or after the start date"
    if(body.recurrence && body.recurrence !== "none" && !body.start_date && !body.due_date) return "A repeating task needs a start or end date"
    return null
}

// Get all tasks for the authenticated user
router.get("/", async (req, res) => {
    try {
        const tasks = await db`
            SELECT id, user_id, title, description, completed, start_date, due_date, priority, recurrence, repeat_until
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
            SELECT id, user_id, title, description, completed, start_date, due_date, priority, recurrence, repeat_until
            FROM tasks
            WHERE user_id = ${req.user.id} AND id = ${req.params.id}
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
    const error = validateTask(req.body ?? {})
    if(error) return res.status(400).json({ error })

    try {
        const created = await db`
            INSERT INTO tasks
                (user_id, title, description, completed, start_date, due_date, priority, recurrence, repeat_until)
            VALUES
                (${req.user.id}, ${req.body.title.trim()}, ${req.body.description ?? null}, ${req.body.completed ?? false},
                 ${req.body.start_date ?? null}, ${req.body.due_date ?? null}, ${req.body.priority ?? 2},
                 ${req.body.recurrence ?? "none"}, ${req.body.repeat_until ?? null})
            RETURNING id, user_id, title, description, completed, start_date, due_date, priority, recurrence, repeat_until
        `
        res.status(201).json(created[0])
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: "Error while creating task" })
    }
})

// Update a task by id for the authenticated user
router.put("/:id", async (req, res) => {
    const error = validateTask(req.body ?? {})
    if(error) return res.status(400).json({ error })

    try {
        const updated = await db.begin(async (transaction) => {
            const currentRows = await transaction`
                SELECT id, user_id, title, description, completed, start_date, due_date, priority, recurrence, repeat_until
                FROM tasks
                WHERE user_id = ${req.user.id} AND id = ${req.params.id}
                FOR UPDATE
            `
            if(currentRows.length === 0) return null

            const current = currentRows[0]
            const completed = req.body.completed ?? current.completed
            const rows = await transaction`
                UPDATE tasks
                SET title = ${req.body.title.trim()},
                    description = ${req.body.description ?? null},
                    completed = ${completed},
                    start_date = ${req.body.start_date ?? null},
                    due_date = ${req.body.due_date ?? null},
                    priority = ${req.body.priority ?? current.priority},
                    recurrence = ${req.body.recurrence ?? current.recurrence},
                    repeat_until = ${req.body.repeat_until ?? null}
                WHERE user_id = ${req.user.id} AND id = ${req.params.id}
                RETURNING id, user_id, title, description, completed, start_date, due_date, priority, recurrence, repeat_until
            `
            const task = rows[0]

            if(!current.completed && task.completed && task.recurrence !== "none") {
                const nextStart = addInterval(task.start_date, task.recurrence)
                const nextDue = addInterval(task.due_date, task.recurrence)
                const nextAnchor = nextDue ?? nextStart
                if(nextAnchor && (!task.repeat_until || nextAnchor <= task.repeat_until)) {
                    await transaction`
                        INSERT INTO tasks
                            (user_id, title, description, start_date, due_date, priority, recurrence, repeat_until)
                        VALUES
                            (${req.user.id}, ${task.title}, ${task.description}, ${nextStart}, ${nextDue},
                             ${task.priority}, ${task.recurrence}, ${task.repeat_until})
                    `
                }
            }

            return task
        })

        if(!updated) return res.status(404).json({ error: "Task not found" })
        res.json(updated)
    } catch (err) {
        if(err.code === "22P02") return res.status(400).json({ error: "Invalid task ID format" })
        console.error(err)
        res.status(500).json({ error: "Error while updating task" })
    }
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