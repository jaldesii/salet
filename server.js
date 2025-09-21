import dotenv from 'dotenv';
import express from 'express';
import axios from 'axios';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const RAW_DATABASE_ID = process.env.NOTION_DATABASE_ID;
const NOTION_DATABASE_ID = formatNotionId(RAW_DATABASE_ID);

function formatNotionId(id) {
  if (!id) return null;
  const cleanId = id.replace(/-/g, '');
  if (cleanId.length !== 32) return id; // Return original if not 32 chars
  
  return `${cleanId.substring(0, 8)}-${cleanId.substring(8, 12)}-${cleanId.substring(12, 16)}-${cleanId.substring(16, 20)}-${cleanId.substring(20)}`;
}

// Validate environment variables
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

// Test endpoint to verify database connection
app.get('/proxy/test-database', async (req, res) => {
  console.log('🧪 Testing database connection...');
  
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
    
    console.log('✅ Database connection successful!');
    console.log('   Database Title:', response.data.title[0]?.plain_text || 'Unknown');
    
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
    console.error('❌ Database test error:', error.response?.data || error.message);
    
    res.status(error.response?.status || 500).json({
      status: 'error',
      message: error.response?.data?.message || 'Failed to access database',
      details: error.response?.data
    });
  }
});

// Health check endpoint
app.get('/proxy/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    databaseId: NOTION_DATABASE_ID,
    rawDatabaseId: RAW_DATABASE_ID
  });
});

// POST endpoint to create new database entries
app.post('/proxy/notion', async (req, res) => {
  console.log('📝 Received data for Notion:', req.body);
  
  try {
    const { amount, customerName, productName, date, paymentMethod } = req.body;

    // Validate required fields
    if (!amount || !customerName || !productName || !date || !paymentMethod) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields'
      });
    }

    const notionData = {
      parent: { database_id: NOTION_DATABASE_ID },
      properties: {
        'Amount': {
          number: parseFloat(amount)
        },
        'Name': {
          title: [
            {
              text: {
                content: customerName
              }
            }
          ]
        },
        'Product Name': {
          rich_text: [
            {
              text: {
                content: productName
              }
            }
          ]
        },
        'Order Date': {
          date: {
            start: date
          }
        },
        'Select': {
          select: {
            name: paymentMethod
          }
        }
      }
    };

    console.log('📤 Sending to Notion API:', JSON.stringify(notionData, null, 2));

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

    console.log('✅ Successfully created Notion page:', response.data.id);
    
    res.json({
      status: 'success',
      message: 'Data successfully saved to Notion',
      pageId: response.data.id
    });

  } catch (error) {
    console.error('❌ Notion API error:', error.response?.data || error.message);
    
    res.status(error.response?.status || 500).json({
      status: 'error',
      message: error.response?.data?.message || 'Failed to create page in Notion',
      details: error.response?.data
    });
  }
});

// GET endpoint to fetch data from Notion
app.get('/proxy/notion', async (req, res) => {
  try {
    console.log('📥 Fetching data from Notion database...');
    
    const response = await axios.post(
      `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`,
      {
        sorts: [
          {
            property: 'Order Date',
            direction: 'descending'
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${NOTION_TOKEN}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        }
      }
    );

    const rows = response.data.results;
    console.log(`📊 Found ${rows.length} records in Notion`);

    // Shape the data for frontend
    const monthly = [];
    const products = [];
    const orders = [];

    rows.forEach((page, index) => {
      const amount = page.properties["Amount"]?.number || 0;
      const customerName = page.properties["Name"]?.title[0]?.text?.content || "Unknown";
      const productName = page.properties["Product Name"]?.rich_text[0]?.text?.content || "Unknown";
      const date = page.properties["Order Date"]?.date?.start || null;
      const paymentMethod = page.properties["Select"]?.select?.name || "Unknown";

      // Monthly data
      if (date) {
        const month = new Date(date).toLocaleString("default", { month: "short", year: 'numeric' });
        const existing = monthly.find((m) => m.name === month);
        if (existing) {
          existing.revenue += amount;
          existing.orders += 1;
          existing.customers += 1;
        } else {
          monthly.push({ 
            name: month, 
            revenue: amount, 
            orders: 1, 
            customers: 1 
          });
        }
      }

      // Product data
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

      // Orders (limit to 10 most recent)
      if (orders.length < 10) {
        orders.push({
          id: page.id || `#${(index+1).toString().padStart(4,"0")}`,
          customer: customerName,
          amount: amount.toLocaleString("en-PH", { style: "currency", currency: "PHP" }),
          product: productName,
          date: date ? new Date(date).toLocaleDateString("en-PH", { 
            year: "numeric", 
            month: "short", 
            day: "numeric" 
          }) : "-",
          paymentMethod: paymentMethod,
          status: "completed"
        });
      }
    });

    console.log('📦 Processed data:', {
      monthly: monthly.length,
      products: products.length,
      orders: orders.length
    });

    res.json({ 
      success: true,
      monthly, 
      products, 
      orders 
    });
    
  } catch (error) {
    console.error("❌ Error fetching Notion data:", error.response?.data || error.message);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch data from Notion",
      error: error.response?.data 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🎉 Proxy server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/proxy/health`);
  console.log(`🔍 Debug: http://localhost:${PORT}/proxy/debug`);
  console.log(`🧪 Test: http://localhost:${PORT}/proxy/test-database`);
});