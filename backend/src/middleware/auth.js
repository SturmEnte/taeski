const jwt = require("jsonwebtoken")

exports.default = function(req, res, next) {
    const token = req.headers.authorization

    if(token == undefined) {
        res.status(401).json({error: "Authorization header with token is required"})
        return
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.user = decoded
        next()
    } catch(err) {
        res.status(401).json({error: "Invalid token"})
    } 
}