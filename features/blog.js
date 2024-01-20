import Blog from "../Schema/Blog.js";

export const latestBlog = async (event) => {
    try {
        let { page } = JSON.parse(event.body);
        let max_limit = 5;

        const blogs = await Blog.find({ draft: false })
            .populate("author", "personal_info.profile_img personal_info.username personal_info.fullname -_id")
            .sort({ publishedAt: -1 })
            .select("blog_id title description banner activity tags publishedAt -_id")
            .skip((page - 1) * max_limit)
            .limit(max_limit);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                "Access-Control-Allow-Origin": "*", // Replace * with your frontend domain if needed
                "Access-Control-Allow-Credentials": true,
            },
            body: JSON.stringify({ blogs }),
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ error: error.message }),
        };
    }
};
