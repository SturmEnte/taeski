const { Router } = require("express")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")

const db = require("../db").default

const router = Router()

router.post("/signup", async (req, res) => {
    const username = req.body.username
    const password = req.body.password

    if(username == undefined) {
        res.status(400).json({error: "Username required"})
        return
    }

    if(password == undefined) {
        res.status(400).json({error: "Password required"})
        return
    }

    const normalizedUsername = username.toString()
    const normalizedPassword = password.toString()

    // Test if username is valid (only letters and numbers) using Regex
    if(!/^[a-zA-Z0-9]+$/.test(normalizedUsername)) {
        res.status(400).json({error: "Invalid username"})
        return
    }

    // Test if password is valid (only letters, numbers, #?*.!$&%)
    if(!/^[a-zA-Z0-9#?*.!$&%]+$/.test(normalizedPassword)) {
        res.status(400).json({error: "Invalid password"})
        return
    }

    // Check if username is already used
    const users = await db`
        SELECT id
        FROM users
        WHERE username = ${normalizedUsername}
    `

    if(users.length > 0) {
        res.status(400).json({error: "Username already in use"})
        return
    }

    const hashedPassword = await bcrypt.hash(
        normalizedPassword,
        Number(process.env.SALT_ROUNDS ?? 10)
    )

    // Create new user
    const createdUsers = await db`
        INSERT INTO users
            (username, password)
        VALUES
            (${normalizedUsername}, ${hashedPassword})
        RETURNING
            id, username
    `

    if(createdUsers == undefined || createdUsers.length == 0) {
        res.status(500).json({error: "Error while creating user"})
        return
    }

    const createdUser = createdUsers[0]
    const token = generateToken({ id: createdUser.id, username: createdUser.username })

    if(token == undefined) {
        res.status(500).json({error: "JWT secret is required"})
        return
    }

    res.status(201).json({ token })
})

router.post("/login", async (req, res) => {
    const username = req.body.username
    const password = req.body.password

    if(username == undefined) {
        res.status(400).json({error: "Username required"})
        return
    }

    if(password == undefined) {
        res.status(400).json({error: "Password required"})
        return
    }

    const normalizedUsername = username.toString()
    const normalizedPassword = password.toString()

    const users = await db`
        SELECT id, username, password
        FROM users
        WHERE username = ${normalizedUsername}
    `

    if(users.length == 0) {
        res.status(401).json({error: "Invalid username or password"})
        return
    }

    const user = users[0]
    const passwordMatches = await bcrypt.compare(normalizedPassword, user.password)

    if(!passwordMatches) {
        res.status(401).json({error: "Invalid username or password"})
        return
    }

    const token = generateToken({ id: user.id, username: user.username })

    if(token == undefined) {
        res.status(500).json({error: "Backend is not configured properly. Please contact the system administrator."})
        return
    }

    res.json({
        token,
        user: {
            id: user.id,
            username: user.username
        }
    })

})

function generateToken(payload) {
    const secret = process.env.JWT_SECRET

    if(secret == undefined) {
        return undefined
    }

    return jwt.sign(payload, secret, { expiresIn: "7d" })
}

exports.default = router