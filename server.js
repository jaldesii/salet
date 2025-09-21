import dotenv from 'dotenv';
import express from 'express';
import axios from 'axios';
import cors from 'cors';

dotenv.config();

const app = express();

// ✅ Allow both localhost at Vercel app
const allowedOrigins = [
  'http://localhost:5173',
  'https://salet-qey5.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(express.json());

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const RAW_DATABASE_ID = process.env.NOTION_DATABASE_ID;

function formatNotionId(id) {
  if (!id) return null;
  const cleanId = id.replace(/-/g, '');
  if (cleanId.length !== 32) return id;
  return `${cleanId.substring(0, 8)}-${cleanId.substring(8, 12)}-${cleanId.substring(12, 16)}-${cleanId.substring(16, 20)}-${cleanId.substring(20)}`;
}

const NOTION_DATABASE_ID = formatNotionId(RAW_DATABASE_ID);

// Validate env
if (!NOTION_TOKEN) {
  console.error('❌ Missing NOTION_TOKEN in .env file');
  process.exit(1);
}
if (!NOTION_DATABASE_ID) {
  console.error('❌ Missing NOTION_DATABASE_ID in .env file');
  process.exit(1);
}

console.log('✅ Environment variables loaded:');
console.log('   NOTION_TOKEN:', NOTION_TOKEN ? 'Present' : 'Missing');
console.log('   Raw Database ID:', RAW_DATABASE_ID);
console.log('   Formatted Database ID:', NOTION_DATABASE_ID);

// Debug endpoint
app.get('/proxy/debug', (req, res) => {
  res.json({
    rawDatabaseId: RAW_DATABASE_ID,
    formattedDatabaseId: NOTION_DATABASE_ID,
    timestamp: new Date().toISOString()
  });
});

// Test Notion DB connection
app.get('/proxy/test-database', async (req, res) => {
  try {
    const response = await axios.get(
      `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}`,
      {
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        }
      }
    );
    res.json({
      status: 'success',
      message: 'Database connection successful',
      data: {
        title: response.data.title[0]?.plain_text,
        id: response.data.id,
        properties: Object.keys(response.data.properties)
      }
    });
  } catch (error) {
    res.status(error.response?.status || 500).json({
      status: 'error',
      message: error.response?.data?.message || 'Failed to access database',
      details: error.response?.data
    });
  }
});

// Health check
app.get('/proxy/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    databaseId: NOTION_DATABASE_ID,
    rawDatabaseId: RAW_DATABASE_ID
  });
});

// Create page
app.post('/proxy/notion', async (req, res) => {
  try {
    const { amount, customerName, productName, date, paymentMethod } = req.body;
    if (!amount || !customerName || !productName || !date || !paymentMethod) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    const notionData = {
      parent: { database_id: NOTION_DATABASE_ID },
      properties: {
        'Amount': { number: parseFloat(amount) },
        'Name': { title: [{ text: { content: customerName } }] },
        'Product Name': { rich_text: [{ text: { content: productName } }] },
        'Order Date': { date: { start: date } },
        'Select': { select: { name: paymentMethod } }
      }
    };

    const response = await axios.post(
      'https://api.notion.com/v1/pages',
      notionData,
      {
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      status: 'success',
      message: 'Data successfully saved to Notion',
      pageId: response.data.id
    });
  } catch (error) {
    res.status(error.response?.status || 500).json({
      status: 'error',
      message: error.response?.data?.message || 'Failed to create page in Notion',
      details: error.response?.data
    });
  }
});

// Fetch data
app.get('/proxy/notion', async (req, res) => {
  try {
    const response = await axios.post(
      `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`,
      { sorts: [{ property: 'Order Date', direction: 'descending' }] },
      {
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        }
      }
    );

    const rows = response.data.results;
    const monthly = [];
    const products = [];
    const orders = [];

    rows.forEach((page, index) => {
      const amount = page.properties["Amount"]?.number || 0;
      const customerName = page.properties["Name"]?.title[0]?.text?.content || "Unknown";
      const productName = page.properties["Product Name"]?.rich_text[0]?.text?.content || "Unknown";
      const date = page.properties["Order Date"]?.date?.start || null;
      const paymentMethod = page.properties["Select"]?.select?.name || "Unknown";

      // Monthly
      if (date) {
        const month = new Date(date).toLocaleString("default", { month: "short", year: 'numeric' });
        const existing = monthly.find((m) => m.name === month);
        if (existing) {
          existing.revenue += amount;
          existing.orders += 1;
          existing.customers += 1;
        } else {
          monthly.push({ name: month, revenue: amount, orders: 1, customers: 1 });
        }
      }

      // Products
      const existingProduct = products.find((p) => p.name === productName);
      if (existingProduct) {
        existingProduct.value += amount;
      } else {
        products.push({
          name: productName,
          value: amount,
          color: "#" + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')
        });
      }

      // Orders (latest 10)
      if (orders.length < 10) {
        orders.push({
          id: page.id || `#${(index + 1).toString().padStart(4, "0")}`,
          customer: customerName,
          amount: amount.toLocaleString("en-PH", { style: "currency", currency: "PHP" }),
          product: productName,
          date: date ? new Date(date).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) : "-",
          paymentMethod,
          status: "completed"
        });
      }
    });

    res.json({ success: true, monthly, products, orders });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch data from Notion",
      error: error.response?.data
    });
  }
});

// Vercel compatible
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🎉 Proxy server running on http://localhost:${PORT}`);
});

export default app; // ✅ importante para Vercel
