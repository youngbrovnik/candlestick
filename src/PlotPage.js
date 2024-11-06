// PlotPage.js
import React, { useState, useEffect, useRef } from "react";
import Plot from "react-plotly.js";
import axios from "axios";
import { Dropdown, DropdownButton, FormCheck } from "react-bootstrap";
import { SMA, BollingerBands } from "technicalindicators";
import { useParams } from "react-router-dom";
import "./PlotPage.css";

const intervals = {
  "1일": "days",
  "1주": "weeks",
  "한 달": "months",
  "1분": "minutes/1",
  "3분": "minutes/3",
  "5분": "minutes/5",
  "10분": "minutes/10",
  "15분": "minutes/15",
  "30분": "minutes/30",
  "1시간": "minutes/60",
  "4시간": "minutes/240",
};

const indicators = ["볼륨", "이동평균선", "볼린저 밴드"];

const fetchData = async (type = "days", market = "KRW-BTC", count = 200, to = null, from = null) => {
  const url = `https://api.upbit.com/v1/candles/${type}?market=${market}&count=${count}${to ? `&to=${to}` : ""}${
    from ? `&from=${from}` : ""
  }`;

  try {
    const response = await axios.get(url);
    const transformedData = response.data
      .map((d) => ({
        date: new Date(d.timestamp),
        open: d.opening_price,
        high: d.high_price,
        low: d.low_price,
        close: d.trade_price,
        volume: d.candle_acc_trade_volume,
      }))
      .reverse(); // 최신 데이터를 오른쪽에 표시하기 위해 데이터 순서 뒤집기

    return transformedData;
  } catch (error) {
    console.error("데이터를 가져오는 중 오류 발생:", error);
    return [];
  }
};

const calculateMovingAverage = (data, period) => {
  return SMA.calculate({ period, values: data });
};

const calculateBollingerBands = (data, period, stdDev) => {
  return BollingerBands.calculate({ period, values: data, stdDev });
};

const PlotPage = () => {
  const { market } = useParams(); // URL 파라미터에서 마켓 코드 가져오기
  const [selectedMarket] = useState(market || "KRW-BTC"); // 'setSelectedMarket' 제거
  const [chartData, setChartData] = useState([]);
  const [displayData, setDisplayData] = useState([]);
  const [ma20Data, setMa20Data] = useState([]);
  const [ma60Data, setMa60Data] = useState([]);
  const [bbData, setBbData] = useState([]);
  const [selectedInterval, setSelectedInterval] = useState("days");
  const [selectedIndicators, setSelectedIndicators] = useState(["볼륨"]);
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false); // 설정 로드 여부

  const intervalRef = useRef(null);

  const upColor = "red";
  const downColor = "blue";

  // 로컬 스토리지에서 설정 불러오기
  useEffect(() => {
    const loadUserSettings = () => {
      const savedInterval = localStorage.getItem("selectedInterval");
      const savedIndicators = localStorage.getItem("selectedIndicators");

      if (savedInterval) {
        setSelectedInterval(savedInterval);
      }

      if (savedIndicators) {
        setSelectedIndicators(JSON.parse(savedIndicators)); // 배열로 복원
      }

      setIsSettingsLoaded(true); // 설정이 로드되었음을 표시
    };

    loadUserSettings();
  }, []);

  // 설정 변경 시 로컬 스토리지에 저장
  useEffect(() => {
    if (isSettingsLoaded) {
      localStorage.setItem("selectedInterval", selectedInterval);
    }
  }, [selectedInterval, isSettingsLoaded]);

  useEffect(() => {
    if (isSettingsLoaded) {
      localStorage.setItem("selectedIndicators", JSON.stringify(selectedIndicators));
    }
  }, [selectedIndicators, isSettingsLoaded]);

  // 실시간 데이터 가져오기
  useEffect(() => {
    if (!isSettingsLoaded) return; // 설정이 로드된 후에만 실행

    const fetchRealTimeData = async () => {
      const data = await fetchData(selectedInterval, selectedMarket);
      if (data.length === 0) return;

      // 새로운 데이터로 상태 업데이트
      setChartData(data);

      const closePrices = data.map((d) => d.close);
      const ma20 = calculateMovingAverage(closePrices, 20);
      const ma60 = calculateMovingAverage(closePrices, 60);
      const bb = calculateBollingerBands(closePrices, 20, 2);

      const ma20FullData = new Array(data.length - ma20.length).fill(null).concat(ma20);
      const ma60FullData = new Array(data.length - ma60.length).fill(null).concat(ma60);
      const bbFullData = new Array(data.length - bb.length).fill(null).concat(bb);

      setMa20Data(ma20FullData);
      setMa60Data(ma60FullData);
      setBbData(bbFullData);

      setDisplayData(data.slice(-100)); // 최신 100개 데이터만 표시
    };

    // 이전 인터벌 클리어
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    const updateInterval = 5000; // 5초마다 업데이트

    fetchRealTimeData();

    intervalRef.current = setInterval(fetchRealTimeData, updateInterval);

    return () => clearInterval(intervalRef.current);
  }, [selectedInterval, selectedMarket, isSettingsLoaded]);

  // 추가: handleRelayout 함수 정의
  const fetchMoreData = async (direction) => {
    if (!chartData.length) return;

    if (direction === "past") {
      const oldestDate = chartData[0].date;
      const toTimestamp = oldestDate.toISOString();
      const moreData = await fetchData(selectedInterval, selectedMarket, 100, toTimestamp);

      if (moreData.length) {
        setChartData((prevData) => [...moreData, ...prevData]);
      }
    } else if (direction === "future") {
      const newestDate = chartData[chartData.length - 1].date;
      const fromTimestamp = newestDate.toISOString();
      const moreData = await fetchData(selectedInterval, selectedMarket, 100, null, fromTimestamp);

      if (moreData.length) {
        setChartData((prevData) => [...prevData, ...moreData]);
      }
    }
  };

  const handleRelayout = (event) => {
    const xRangeStart = event["xaxis.range[0]"];
    const xRangeEnd = event["xaxis.range[1]"];

    if (xRangeStart && new Date(xRangeStart) < chartData[0].date) {
      fetchMoreData("past");
    } else if (xRangeEnd && new Date(xRangeEnd) > chartData[chartData.length - 1].date) {
      fetchMoreData("future");
    }

    if (xRangeStart && xRangeEnd) {
      const newDisplayData = chartData.filter(
        (d) => new Date(d.date) >= new Date(xRangeStart) && new Date(d.date) <= new Date(xRangeEnd)
      );
      setDisplayData(newDisplayData);
    }

    if (event["xaxis.autorange"]) {
      const latestDate = displayData[displayData.length - 1]?.date;
      if (latestDate) {
        const latestVisibleIndex = chartData.findIndex((d) => d.date.getTime() === latestDate.getTime());
        const startIndex = Math.max(0, latestVisibleIndex - 99);
        const latest100Data = chartData.slice(startIndex, latestVisibleIndex + 1);
        setDisplayData(latest100Data);
      }
    }
  };

  const handleIntervalChange = (intervalKey) => {
    setSelectedInterval(intervals[intervalKey]);
  };

  const handleIndicatorChange = (indicator) => {
    setSelectedIndicators((prevSelected) =>
      prevSelected.includes(indicator) ? prevSelected.filter((i) => i !== indicator) : [...prevSelected, indicator]
    );
  };

  const getSelectedIntervalLabel = () => {
    return Object.keys(intervals).find((key) => intervals[key] === selectedInterval);
  };

  // 시작 인덱스 계산
  const startIndex = chartData.length - displayData.length;

  return (
    <div className="PlotPage">
      <div className="dropdown-container">
        <DropdownButton id="dropdown-indicator-button" title="지표" className="dropdown-button">
          {indicators.map((indicator) => (
            <Dropdown.Item key={indicator} onClick={() => handleIndicatorChange(indicator)}>
              <FormCheck
                type="checkbox"
                label={indicator}
                checked={selectedIndicators.includes(indicator)}
                onChange={() => handleIndicatorChange(indicator)}
              />
            </Dropdown.Item>
          ))}
        </DropdownButton>
        <DropdownButton id="dropdown-interval-button" title={getSelectedIntervalLabel()} className="dropdown-button">
          {Object.keys(intervals).map((key) => (
            <Dropdown.Item key={key} onClick={() => handleIntervalChange(key)}>
              {key}
            </Dropdown.Item>
          ))}
        </DropdownButton>
      </div>
      <Plot
        data={[
          {
            x: displayData.map((d) => d.date),
            close: displayData.map((d) => d.close),
            decreasing: { line: { color: downColor } },
            high: displayData.map((d) => d.high),
            increasing: { line: { color: upColor } },
            low: displayData.map((d) => d.low),
            open: displayData.map((d) => d.open),
            type: "candlestick",
            xaxis: "x",
            yaxis: "y",
            hovertemplate:
              "날짜: %{x|%Y-%m-%d}<br>" +
              "시가: %{open}<br>" +
              "고가: %{high}<br>" +
              "저가: %{low}<br>" +
              "종가: %{close}<br>" +
              "<extra></extra>",
          },
          ...(selectedIndicators.includes("볼륨")
            ? [
                {
                  x: displayData.map((d) => d.date),
                  y: displayData.map((d) => d.volume),
                  type: "bar",
                  xaxis: "x",
                  yaxis: "y2",
                  marker: {
                    color: displayData.map((d) => (d.close > d.open ? upColor : downColor)),
                  },
                  hovertemplate: "%{x|%Y-%m-%d}<br>거래량: %{y}<extra></extra>",
                },
              ]
            : []),
          ...(selectedIndicators.includes("이동평균선")
            ? [
                {
                  x: displayData.map((d) => d.date),
                  y: displayData.map((_, i) => ma20Data[i + startIndex]),
                  type: "scatter",
                  mode: "lines",
                  line: { color: "red" },
                  name: "MA 20",
                },
                {
                  x: displayData.map((d) => d.date),
                  y: displayData.map((_, i) => ma60Data[i + startIndex]),
                  type: "scatter",
                  mode: "lines",
                  line: { color: "blue" },
                  name: "MA 60",
                },
              ]
            : []),
          ...(selectedIndicators.includes("볼린저 밴드")
            ? [
                {
                  x: displayData.map((d) => d.date),
                  y: displayData.map((_, i) => bbData[i + startIndex]?.middle),
                  type: "scatter",
                  mode: "lines",
                  line: { color: "red" },
                  name: "BB Middle",
                },
                {
                  x: displayData.map((d) => d.date),
                  y: displayData.map((_, i) => bbData[i + startIndex]?.upper),
                  type: "scatter",
                  mode: "lines",
                  line: { color: "black" },
                  name: "BB Upper",
                },
                {
                  x: displayData.map((d) => d.date),
                  y: displayData.map((_, i) => bbData[i + startIndex]?.lower),
                  type: "scatter",
                  mode: "lines",
                  line: { color: "black" },
                  name: "BB Lower",
                },
              ]
            : []),
        ]}
        layout={{
          dragmode: "pan",
          width: 990,
          margin: { r: 10, t: 25, b: 40, l: 60 },
          showlegend: true,
          xaxis: {
            autorange: true,
            domain: [0, 1],
            title: "Date",
            type: "date",
            rangeslider: { visible: false },
          },
          yaxis: {
            autorange: true,
            domain: [0.3, 1],
            type: "linear",
          },
          yaxis2: {
            autorange: true,
            domain: [0, 0.2],
            type: "linear",
          },
          grid: {
            rows: 2,
            columns: 1,
            subplots: [["xy"], ["xy2"]],
          },
        }}
        onRelayout={handleRelayout}
        config={{ modeBarButtonsToAdd: ["pan2d"], displayModeBar: true }}
      />
    </div>
  );
};

export default PlotPage;
