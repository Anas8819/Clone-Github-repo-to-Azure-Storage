import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import simpleGit from "simple-git";
import * as path from "path";
import * as fs from "fs";
import { BlobServiceClient } from "@azure/storage-blob";

export async function httpTrigger1(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    context.log(`Http function processed request for url "${request.url}"`);

    const name = request.query.get('name') || await request.text() || 'world';

    const repoUrl = 'https://github.com/Anas8819/TradeApp.git';

    try {
        // Embed PAT into the repo URL securely
        const authenticatedUrl = repoUrl.replace(
            /^https:\/\/(github\.com)/,
            `https://<your PAT here>@$1`
        );

        // Use a temporary directory to clone into
        const targetDir = path.join("C:", "UserItems", "clonedapps", Date.now().toString());
        fs.mkdirSync(targetDir, { recursive: true });

        const git = simpleGit();
        await git.clone(authenticatedUrl, targetDir);

        const connectionString = "connectionString";
        const containerName = "clonedrepos";

        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(containerName);
        await containerClient.createIfNotExists();

        const uploadFiles = async (dirPath: string, basePath = dirPath) => {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                const blobPath = path.relative(basePath, fullPath).replace(/\\/g, "/");

                if (entry.isDirectory()) {
                    await uploadFiles(fullPath, basePath);
                } else {
                    const blockBlobClient = containerClient.getBlockBlobClient(blobPath);
                    const fileContent = fs.readFileSync(fullPath);
                    await blockBlobClient.uploadData(fileContent);
                    context.log(`✅ Uploaded: ${blobPath}`);
                }
            }
        };

        await uploadFiles(targetDir);

        return {
            status: 200,
            body: `✅ Private repository cloned successfully to: ${targetDir}`,
        };
    } catch (error: any) {
        context.log("❌ Clone failed:", error.message);
        return {
            status: 500,
            body: `❌ Failed to clone the repository: ${error.message}`,
        };

        return { body: `Hello, ${name}!` };
    };
}

app.http('httpTrigger1', {
    methods: ['GET', 'POST'],
    authLevel: 'anonymous',
    handler: httpTrigger1
});
