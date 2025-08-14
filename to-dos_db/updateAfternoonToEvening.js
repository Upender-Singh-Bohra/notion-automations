import { Client } from "@notionhq/client";
import dotenv from "dotenv";
dotenv.config();

// Setup Notion client with your integration token
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_TODOS_DATABASE_ID;

function getTodayIST() {
  const now = new Date();
  // IST offset is UTC +5:30 in minutes

  const istOffset = 5.5 * 60;
  // Convert current UTC time to IST

  const istTime = new Date(now.getTime() + istOffset * 60 * 1000);

  const year = istTime.getUTCFullYear();
  const month = String(istTime.getUTCMonth() + 1).padStart(2, "0");
  const day = String(istTime.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Get all tasks with today's date, "afternoon" status, and unchecked "Done ?"
async function getAfternoonTasksForToday() {
  const today = getTodayIST();

  const response = await notion.databases.query({
    database_id: databaseId,
    filter: {
      and: [
        {
          property: "Date",
          date: {
            equals: today,
          },
        },
        {
          or: [
            {
              property: "Time of Day",
              status: { equals: "morning" },
            },
            {
              property: "Time of Day",
              status: { equals: "afternoon" },
            },
          ],
        },
        {
          property: "Done ?",
          checkbox: {
            equals: false,
          },
        },
      ],
    },
  });

  return response.results;
}

// Update "Time of Day" property to "evening"
async function updateTaskStatus(pageId) {
  await notion.pages.update({
    page_id: pageId,
    properties: {
      "Time of Day": {
        status: {
          name: "evening",
        },
      },
    },
  });
}

async function run() {
  try {
    const tasks = await getAfternoonTasksForToday();
    console.log(`Found ${tasks.length} tasks to update.`);

    for (const task of tasks) {
      await updateTaskStatus(task.id);
      console.log(`Updated task: ${task.id}`);
    }

    console.log("✅ Done updating tasks to Evening.");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

run();
