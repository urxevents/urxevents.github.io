$("#day2").hide()
$( "#second-day" ).addClass("day-off")
$( "#second-day" ).click(function() {
	$( "#second-day" ).removeClass("day-off")
	$( "#first-day" ).addClass("day-off")
  $("#day1").hide()
  $("#day2").show()
  // alert("second clickled!")
});

$( "#first-day" ).click(function() {
	$( "#first-day" ).removeClass("day-off")
	$( "#second-day" ).addClass("day-off")
  $("#day1").show()
  $("#day2").hide()
  // alert("first clickled!")
});