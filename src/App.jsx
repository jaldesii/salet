import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './Components/Dashboard/Dashboard';
import AddForm from './Components/AddForm/AddForm';

const Footer = () => {
  return (
    <div style={{
      textAlign: 'center',
      padding: '10px',
      fontFamily: "'Poppins', sans-serif",
      fontSize: '14px',
      color: '#333'
    }}>
      Developed by Justin Miguel Alde @ 2025
    </div>
  );
};

const App = () => {
  return (
    <Router>
      <div>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/add-product" element={<AddForm />} />
        </Routes>
        <Footer />
      </div>
    </Router>
  );
};

export default App;