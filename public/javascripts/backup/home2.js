//init
var port = 3000;
var chart;
var dataToDisplay;
$("#searcher_date").val(new Date().toISOString().split("T")[0]);
//----------------------------------------------------------------------
// random gen function
function generateChartData(date, minuteNum, interval) {
	// current date
	var firstDate = date;
	var chartData = [{
		time: firstDate,
		price: "100"
	}];


	// and generate 500 data items
	for (var i = 5; i <= minuteNum; i += interval) {
		var newDate = new Date(firstDate);
		// each time we add one minute
		newDate.setMinutes(newDate.getMinutes() + i);


		// add data item to the array
		if (chartData[newDate]) {
			chartData[newDate] = genDatum(chartData, newDate);
		} else {
			chartData.push(genDatum(chartData, newDate));
		}
	}
	return chartData;
}

function genDatum(chartData, date) {
	// some random number
	var ref = parseFloat(chartData[chartData.length - 1].price);
	var rand = Math.random() * 10 - 5;
	var price = (ref + rand).toFixed(2);
	var forecast = (ref + rand + Math.random() * 20 - 10).toFixed(2);
	return {
		time: date,
		price: price,
		forecast: forecast
	};
}


//----------------------------------------------------------------------
// can be modified to Recommend
dataToDisplay = generateChartData(new Date(), 400, 1);

// chart init
$.getJSON("config/generalChart.json", (style) => {
    style.valueAxes[1].labelFunction = function(data){return (data * 100).toFixed(2) + "%";};

	chart = AmCharts.makeChart("chartdiv", style);
	chart.addListener('dataUpdated', zoomChart);
	/* init as random data */
	chart.dataProvider = dataToDisplay;
	calcAccuracy();
	chart.validateData();

	/* init as server's data */
	// $("#searcher").focus().focusout();
});


// event handler
//----------------------------------------------------------------------
// zoom
var oldStartDate, oldEndDate;

function zoomChart() {
	if (document.getElementById('tracker').checked) {
		var interval = document.getElementById('trackerInterval').value;
		var lastDate = new Date(chart.dataProvider[chart.dataProvider.length - 1].time);
		var startDate = new Date(lastDate)
		startDate.setMinutes(startDate.getMinutes() - interval - 5);
		lastDate.setMinutes(lastDate.getMinutes() + 5);
		chart.zoomToDates(startDate, lastDate);
		recordDate();
	} else {
		chart.zoomToDates(oldStartDate, oldEndDate);
	}
}
// record last value
function recordDate() {
	oldStartDate = new Date(chart.startDate);
	oldEndDate = new Date(chart.endDate);
}
//----------------------------------------------------------------------
// calculate 準確率
function calcAccuracy() {
	console.log("Calculating...");
	var mergedData = chart.dataProvider;
	if (mergedData.length < 2) return;
	var accuracy = {
		size: 0,
		total: 0
	};

	for (var i in mergedData) {
		if (!mergedData[i].forecast || !mergedData[i].price) continue;
		var forecast_delta = mergedData[i].forecast - mergedData[i - 1].price;
		var price_delta = mergedData[i].price - mergedData[i - 1].price;
		if (forecast_delta * price_delta > 0)
			++accuracy.total;

		++accuracy.size;
		dataToDisplay[i].accuracy_rate = parseFloat((accuracy.total/accuracy.size).toFixed(4));
	}
	accuracy.rate = accuracy.total / accuracy.size;
	accuracy.toString = function () {
		return '{total: '+ accuracy.total + ', size: ' +accuracy.size +'}';
	}
	$('#accuracymsg').trigger('CalcDone', accuracy.rate);
	$('#notemsg').trigger('CalcDone', accuracy);
	return accuracy;
}

//----------------------------------------------------------------------
$("#trackerInterval").on("change", () => {
	zoomChart();
})

//----------------------------------------------------------------------
// #searcher event
$("#searcher").on("keydown", function(event) {
	if (event.keyCode == 13) {
		var stock = this.value;
		var date = $("#searcher_date").val().split('-').join('');
		lastTimeUpdate = undefined;
		searchHandler(stock, date);
	}
})
$("#searcher").on("focusout", function() {
	var stock = this.value;
	var date = $("#searcher_date").val().split('-').join('');
	lastTimeUpdate = undefined;
	searchHandler(stock, date);
})

//----------------------------------------------------------------------
// #searcher_date event
$("#searcher_date").on("focusout", function() {
		var stock = $("#searcher").val();
		var date = this.value.split('-').join('');
		// find the data
		lastTimeUpdate = undefined;
		searchHandler(stock, date);
	})
//----------------------------------------------------------------------
var lastTimeUpdate;
function searchHandler(stock_num, date) {
	// 記錄當前zoom的起迄
	recordDate();
	dataToDisplay = [];
	$.get("/StockData/price", {
			stock: stock_num,
			date: date,
			lastTimeUpdate: lastTimeUpdate,
		},
		(response) => {
			if (response.msg == 'DataFound') {
				$("#priceDatamsg").trigger("DataFound", ["找到此股票", response.content]);
				lastTimeUpdate = (new Date()).getTime();
			}
			else if(response.msg == 'AlreadyUpdate'){
				$("#priceDatamsg").trigger("AlreadyUpdate", "");
			}
			else {
				$("#priceDatamsg").trigger("DataNotFound", "沒有找到此股票(" + stock_num + ")！");
			}
		}
	);
	$.get("/StockData/forecast", {
			stock: stock_num,
			date: date,
			lastTimeUpdate: lastTimeUpdate,
		},
		(response) => {
			if (response.msg == 'DataFound') {
				$("#forecastDatamsg").trigger("DataFound", ["找到此股票預測資料", response.content]);
				lastTimeUpdate = (new Date()).getTime();
			}
			else if(response.msg == 'AlreadyUpdate'){
				$("#forecastDatamsg").trigger("AlreadyUpdate", "");
			}
			else {
				$("#forecastDatamsg").trigger("DataNotFound", "沒有找到股票預測資料(" + stock_num + ")！");
			}
		}
	);

}
//----------------------------------------------------------------------
// data not found event
$("#priceDatamsg").on('DataNotFound', (event, msg) => {
		$("#priceDatamsg").css('color', 'red');
		$("#priceDatamsg").html(msg);
	})
	// data found event
$("#priceDatamsg").on('DataFound', (event, msg, data) => {
	$("#priceDatamsg").css('color', 'green');
	$("#priceDatamsg").html(msg);
	// render
	dataToDisplay = dataToDisplay.concat(data);
	dataToDisplay = mergeStockData(dataToDisplay);
	chart.dataProvider = dataToDisplay;
	chart.validateData();
});
$("#priceDatamsg").on('AlreadyUpdate', (event, msg) => {
	$("#priceDatamsg").css('color', 'blue');
	$("#priceDatamsg").html(msg);

	// do nothing
});
//----------------------------------------------------------------------
// data not found event
$("#forecastDatamsg").on('DataNotFound', (event, msg) => {
		$("#forecastDatamsg").css('color', 'red');
		$("#forecastDatamsg").html(msg);
	})
	// data found event
$("#forecastDatamsg").on('DataFound', (event, msg, data) => {
	$("#forecastDatamsg").css('color', 'green');
	$("#forecastDatamsg").html(msg);
	// render
	dataToDisplay = dataToDisplay.concat(data);
	dataToDisplay = mergeStockData(dataToDisplay);
	chart.dataProvider = dataToDisplay;
	calcAccuracy();
	chart.validateData();
});

$("#forecastDatamsg").on('AlreadyUpdate', (event, msg) => {
	$("#forecastDatamsg").css('color', 'blue');
	$("#forecastDatamsg").html(msg.toString());

	// do nothing
});

//----------------------------------------------------------------------
$('#accuracymsg').on('CalcDone', function(event, rate) {
	var msg;
	switch (true) {
		case rate < 0.5:
			$(this).css('color', 'red');
			break;
		case rate >= 0.5 && rate < 0.85:
			$(this).css('color', 'orange');
			break;
		case rate >= 0.85:
			$(this).css('color', 'green');
			break;
		default:
			$(this).html('準確率計算Error！');
			return;
	}
	msg = (rate * 100).toFixed(2) + '%';
	$(this).html('準確率：' + msg);
});

$('#notemsg').on('CalcDone', function(event,msg){
	$(this).css('color','blue');
	$(this).html("Note: " + msg.toString());
})
//----------------------------------------------------------------------
// merge data
function mergeStockData(data) {
	var merged = {};
	var merged_arr = [];
	data.forEach(function(item, pos) {
		if (!merged[item.time])
			merged[item.time] = {};

		for (var attrName in item) {
			if (attrName == 'stock') continue;
			merged[item.time][attrName] = item[attrName];
		}
	});

	for (var time in merged) {
		var obj;
		merged_arr.push({
			time: time,
			price: merged[time].price,
			forecast: merged[time].forecast
		});
	}
	return merged_arr;
}




//----------------------------------------------------------------------

// for 3s a time loop update server's data
// var refreshId = setInterval(()=>{
// 	var stock = $("#searcher").val();
// 	var date = $("#searcher_date").val().split('-').join('');
// 	searchHandler(stock, date);
// },3000);

//----------------------------------------------------------------------

// for 3s a time loop update random data
// var refreshId = setInterval(()=>{
// 	var nextTime = new Date(dataToDisplay[dataToDisplay.length - 1].time);
// 	nextTime.setMinutes(nextTime.getMinutes() + 5);

// 	if(dataToDisplay[nextTime]){
// 		dataToDisplay[nextTime] = genDatum(dataToDisplay, nextTime);
// 	}
// 	else{
// 		dataToDisplay.push(genDatum(dataToDisplay, nextTime));
// 	}
// 	chart.dataProvider = dataToDisplay;
// 	chart.validateData();
// },3000);


