import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";


// to-do's for auth middleware:
    //verify the user (in auth middleware):
    //Get access token from cookies or from header(Authorization)
    //verify Token
    //Create a response after verifying the token
    //store it in an object(of any name)
    // run next() (as it is a middleware)

export const verifyJWT = asyncHandler(async(req, _, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")
        //Get access token from cookies or from header(Authorization)
        // console.log(token);
        
        if (!token) {
            throw new ApiError(401, "Unauthorized request")
        }
    
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET) //verify Token
    
        const user = await User.findById(decodedToken?._id).select("-password -refreshToken")
        //Create a response after verifying the token
    
        if (!user) {
            
            throw new ApiError(401, "Invalid Access Token")
        }   
    
        req.user = user;    //store it in an object(of any name)
        next()  // run next() (as it is a middleware)
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid access token")
    }
    
})
