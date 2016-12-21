<?

$query = 'SELECT city, state, country FROM geonames ORDER BY city, state, country';
$result = run_query($query);

$prev_info = '';

while ($row = query_result_array($result)) {
	$this_info = $row['city'].$row['state'].$row['country'];

	if ($prev_info == $this_info) { echo $this_info. '--' .$prev_info. '<br/>'; }

	$prev_info = $this_info;
}

?>
