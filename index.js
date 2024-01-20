
import serverless from "serverless-http"
import app from "./app.js"
import { mediaFeature } from "./features/medias.js";
import { latestBlog } from "./features/blog.js";

export const handler = serverless(app);
export const MediaHandler = mediaFeature;
export { latestBlog }

