// App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import PlotPage from "./PlotPage";
import CoinList from "./CoinList";
import "./App.css";

const App = () => {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="candlestick/" element={<CoinList />} />
          <Route path="candlestick/coins/:market" element={<PlotPage />} />
        </Routes>
      </div>
    </Router>
  );
};

export default App;
