import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import './Dashboard.scss';
import AddForm from '../AddForm/AddForm';

const Dashboard = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [activeMetric, setActiveMetric] = useState('revenue');
  const [showModal, setShowModal] = useState(false);
  const [monthlyData, setMonthlyData] = useState([]);
  const [productData, setProductData] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // ✅ Fetch from Notion when page loads with proper error handling
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        console.log('🔄 Fetching data from server...');
        const res = await fetch("http://localhost:3000/proxy/notion");
        
        if (!res.ok) {
          throw new Error(`Server returned ${res.status}: ${res.statusText}`);
        }
        
        const data = await res.json();
        
        if (!data.success) {
          throw new Error(data.message || 'Failed to fetch data');
        }

        console.log('✅ Data received:', {
          monthly: data.monthly?.length || 0,
          products: data.products?.length || 0,
          orders: data.orders?.length || 0
        });

        setMonthlyData(data.monthly || []);
        setProductData(data.products || []);
        setRecentOrders(data.orders || []);
        
        // Cache data in localStorage for better UX
        localStorage.setItem('cachedData', JSON.stringify({
          monthly: data.monthly,
          products: data.products,
          orders: data.orders,
          timestamp: new Date().getTime()
        }));
        
      } catch (err) {
        console.error("❌ Error fetching data:", err);
        setError(err.message);
        
        // Try to load cached data
        const cachedData = localStorage.getItem('cachedData');
        if (cachedData) {
          try {
            const parsedData = JSON.parse(cachedData);
            // Only use cache if it's less than 1 hour old
            if (new Date().getTime() - parsedData.timestamp < 3600000) {
              setMonthlyData(parsedData.monthly || []);
              setProductData(parsedData.products || []);
              setRecentOrders(parsedData.orders || []);
              console.log('📦 Using cached data');
            }
          } catch (cacheError) {
            console.error('Error parsing cached data:', cacheError);
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  const currentData = monthlyData;
  const totalRevenue = currentData.reduce((sum, item) => sum + item.revenue, 0);
  const totalOrders = currentData.reduce((sum, item) => sum + item.orders, 0);
  const totalCustomers = currentData.reduce((sum, item) => sum + item.customers, 0);
  const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;

  const metrics = [
    { 
      id: 'revenue', 
      title: 'Total Revenue', 
      value: totalRevenue.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' }), 
      change: '+0%',
      positive: true 
    },
    { 
      id: 'orders', 
      title: 'Total Orders', 
      value: totalOrders.toString(), 
      change: '+0%',
      positive: true 
    },
    { 
      id: 'customers', 
      title: 'New Customers', 
      value: totalCustomers.toString(), 
      change: '+0%',
      positive: true 
    },
    { 
      id: 'avg', 
      title: 'Avg Order Value', 
      value: avgOrderValue.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' }), 
      change: '+0%',
      positive: true 
    }
  ];

  const handleAddProduct = () => {
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleFormSubmit = async (formData) => {
    try {
      // Update local state immediately for better UX
      const { amount, customerName, productName, date, paymentMethod } = formData;
      const amountNum = parseFloat(amount);
      const month = new Date(date).toLocaleString('default', { month: 'short', year: 'numeric' });

      // Update monthlyData
      setMonthlyData(prev => {
        const existingMonth = prev.find(item => item.name === month);
        if (existingMonth) {
          const existingCustomer = recentOrders.some(order => order.customer === customerName);
          return prev.map(item =>
            item.name === month
              ? {
                  ...item,
                  revenue: item.revenue + amountNum,
                  orders: item.orders + 1,
                  customers: existingCustomer ? item.customers : item.customers + 1
                }
              : item
          );
        }
        return [
          ...prev,
          { name: month, revenue: amountNum, orders: 1, customers: 1 }
        ];
      });

      // Update productData
      setProductData(prev => {
        const existingProduct = prev.find(item => item.name === productName);
        if (existingProduct) {
          return prev.map(item =>
            item.name === productName
              ? { ...item, value: item.value + amountNum }
              : item
          );
        }
        const newColor = colors[prev.length % colors.length];
        return [
          ...prev,
          { name: productName, value: amountNum, color: newColor }
        ];
      });

      // Update recentOrders
      setRecentOrders(prev => [
        {
          id: `new-${Date.now()}`,
          customer: customerName,
          amount: amountNum.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' }),
          product: productName,
          date: new Date(date).toLocaleDateString('en-PH', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
          }),
          paymentMethod: paymentMethod,
          status: 'completed'
        },
        ...prev.slice(0, 9) // Keep only the latest 10 orders
      ]);

    } catch (error) {
      console.error('Error updating local state:', error);
    }
  };

  const refreshData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:3000/proxy/notion?refresh=" + Date.now());
      const data = await res.json();
      
      if (data.success) {
        setMonthlyData(data.monthly || []);
        setProductData(data.products || []);
        setRecentOrders(data.orders || []);
      }
    } catch (err) {
      setError('Failed to refresh data');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <h2>Error Loading Data</h2>
        <p>{error}</p>
        <button onClick={refreshData} className="retry-button">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard__header">
        <div className="dashboard__title">
          <h1>Sales Dashboard</h1>
          <p>Track your business performance</p>
        </div>
        <div className="dashboard__controls">
         
          <button 
            className="dashboard__add-btn"
            onClick={handleAddProduct}
          >
            <ion-icon name="add-outline"></ion-icon>
            Add Sale
          </button>
        </div>
      </div>

      <div className="dashboard__metrics">
        {metrics.map((metric) => (
          <div 
            key={metric.id} 
            className={`metric-card ${activeMetric === metric.id ? 'metric-card--active' : ''}`}
            onClick={() => setActiveMetric(metric.id)}
          >
            <div className="metric-card__header">
              <h3>{metric.title}</h3>
            </div>
            <div className="metric-card__value">
              <span className="metric-card__number">{metric.value}</span>
              <span className={`metric-card__change ${metric.positive ? 'metric-card__change--positive' : 'metric-card__change--negative'}`}>
                {metric.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard__charts">
        <div className="chart-container">
          <div className="chart-container__header">
            <h3>Revenue Trend</h3>
            <div className="chart-tabs">
              <button 
                className={`chart-tab ${activeMetric === 'revenue' ? 'chart-tab--active' : ''}`}
                onClick={() => setActiveMetric('revenue')}
              >
                Revenue
              </button>
              <button 
                className={`chart-tab ${activeMetric === 'orders' ? 'chart-tab--active' : ''}`}
                onClick={() => setActiveMetric('orders')}
              >
                Orders
              </button>
              <button 
                className={`chart-tab ${activeMetric === 'customers' ? 'chart-tab--active' : ''}`}
                onClick={() => setActiveMetric('customers')}
              >
                Customers
              </button>
            </div>
          </div>
          <div className="chart-container__content">
            {currentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={currentData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="name" 
                    stroke="#6B7280"
                    fontSize={12}
                  />
                  <YAxis 
                    stroke="#6B7280"
                    fontSize={12}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #E5E7EB',
                      borderRadius: '8px',
                      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value) => [value.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' }), activeMetric]}
                  />
                  <Line 
                    type="monotone" 
                    dataKey={activeMetric} 
                    stroke="#3B82F6" 
                    strokeWidth={3}
                    dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="no-data">
                <p>No data available</p>
              </div>
            )}
          </div>
        </div>

        <div className="chart-container">
          <div className="chart-container__header">
            <h3>Sales by Product</h3>
          </div>
          <div className="chart-container__content">
            {productData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={productData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {productData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value) => [value.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' }), 'Amount']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="chart-legend">
                  {productData.map((item, index) => (
                    <div key={index} className="legend-item">
                      <div 
                        className="legend-item__color" 
                        style={{ backgroundColor: item.color }}
                      ></div>
                      <span className="legend-item__text">{item.name}</span>
                      <span className="legend-item__value">{item.value.toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="no-data">
                <p>No product data available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="dashboard__activity">
        <div className="activity-container">
          <div className="activity-container__header">
            <h3>Recent Orders</h3>
            <button className="activity-container__button" onClick={refreshData}>
              Refresh
            </button>
          </div>
          <div className="activity-list">
            <div className="activity-item activity-item--header">
              <span className="activity-item__id">Order ID</span>
              <span className="activity-item__customer">Customer</span>
              <span className="activity-item__product">Product</span>
              <span className="activity-item__date">Date</span>
              <span className="activity-item__payment">Payment</span>
              <span className="activity-item__amount">Amount</span>
              <span className="activity-item__status">Status</span>
            </div>
            {recentOrders.length > 0 ? (
              recentOrders.map((order) => (
                <div key={order.id} className="activity-item">
                  <span className="activity-item__id">{order.id.substring(0, 8)}...</span>
                  <span className="activity-item__customer">{order.customer}</span>
                  <span className="activity-item__product">{order.product}</span>
                  <span className="activity-item__date">{order.date}</span>
                  <span className="activity-item__payment">{order.paymentMethod}</span>
                  <span className="activity-item__amount">{order.amount}</span>
                  <span className={`activity-item__status activity-item__status--${order.status}`}>
                    {order.status}
                  </span>
                </div>
              ))
            ) : (
              <div className="activity-item">
                <span className="activity-item__id">No orders available</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <AddForm onClose={handleCloseModal} onSubmit={handleFormSubmit} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;