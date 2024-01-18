
import 'dotenv/config';
import { Client, Account, ID, Databases, Storage, Query } from 'appwrite'

export class Service {
    client = new Client();
    bucket;

    constructor() {
        this.client
            .setEndpoint(process.env.APPWRITE_API_URL)
            .setProject(process.env.APPWRITE_PROJECT_ID);

        this.bucket = new Storage(this.client);
    }

    async uploadFile(file) {
        try {
            return await this.bucket.createFile(
                process.env.APPWRITE_BUCKET_ID,
                ID.unique(),
                file
            )
        } catch (error) {
            console.log("Appwrite service :: uploadFile :: error ", error);
            return false;
        }
    }

    async imageList(){
        try {
            return await this.bucket.listFiles(process.env.APPWRITE_BUCKET_ID)
        } catch (error) {
            console.log("Appwrite services :: imageList :: error ", error);
            return null;
        }
    }

    getFilePreview(fileId) {
        return this.bucket.getFilePreview(
            process.env.APPWRITE_BUCKET_ID,
            fileId
        )
    }



}
//let {$id, data : {href}} = await appwriteServices.uploadFile(img);


const appwriteServices = new Service();
export default appwriteServices