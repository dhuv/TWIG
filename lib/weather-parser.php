<html>

<body>
<?

$states = array ('AL'=>'Alabama', 'AK'=>'Alaska', 'AZ'=>'Arizona', 'AR'=>'Arkansas', 'CA'=>'California',
	'CO'=>'Colorado', 'CT'=>'Connecticut', 'DE'=>'Delaware', 'FL'=>'Florida', 'GA'=>'Georgia',
	'HI'=>'Hawaii', 'ID'=>'Idaho', 'IL'=>'Illinois', 'IN'=>'Indiana', 'IA'=>'Iowa',
	'KS'=>'Kansas', 'KY'=>'Kentucky', 'LA'=>'Louisiana', 'ME'=>'Maine', 'MD'=>'Maryland',
	'MA'=>'Massachusetts', 'MI'=>'Michigan', 'MN'=>'Minnesota', 'MS'=>'Mississippi', 'MO'=>'Missouri',
	'MT'=>'Montana', 'NE'=>'Nebraska', 'NV'=>'Nevada', 'NH'=>'New Hampshire', 'NJ'=>'New Jersey',
	'NM'=>'New Mexico', 'NY'=>'New York', 'NC'=>'North Carolina', 'ND'=>'North Dakota', 'OH'=>'Ohio',
	'OK'=>'Oklahoma', 'OR'=>'Oregon', 'PA'=>'Pennsylvania', 'RI'=>'Rhode Island', 'SC'=>'South Carolina',
	'SD'=>'South Dakota', 'TN'=>'Tennessee', 'TX'=>'Texas', 'UT'=>'Utah', 'VT'=>'Vermont',
	'VA'=>'Virginia', 'WA'=>'Washington', 'WV'=>'West Virginia', 'WI'=>'Wisconsin', 'WY'=>'Wyoming',
	'DC'=>'District of Columbia'
	);

// regex to match the data format
$reg = '/^([A-Z]+)([0-9]+)(.*)\s+([\.\-0-9]+)\s+([\.\-0-9]+)\s+([\.\-0-9]+)\s+([\.\-0-9]+)\s+([\.\-0-9]+)\s+([\.\-0-9]+)\s+(\-?[0-9]+\.[0-9]+)\s?(\-?[0-9]+\.[0-9]+)$/';

$fp = fopen('Inserts.txt', 'w');
fwrite($fp, 'INSERT INTO geonames (source, city, state, country, yr_no, latitude, longitude) VALUES ' ."\n");
$handle = @fopen('places2k.txt', 'r');
if ($handle) {
	$line = 0;
    while (($buffer = fgets($handle, 1024)) !== false) {
		$line++;
		if (!preg_match($reg, $buffer, $data)) { echo 'Line ' .$line. ' does not match regex<br/>'; continue; }

		if (!isset($states[$data[1]])) { echo $data[1]. ' does not exist<br/>'; continue; }
		$city = preg_split('/[\s]/', trim($data[3]));
		array_pop($city);
		$city = implode(' ', $city);
		if (strpos($city, ',') !== FALSE) {
			$city = substr($city, 0, strpos($city, ','));
		}
		$state = $states[$data[1]];
		$country = 'United States';

		$latitude = trim($data[10]);
		$longitude = ($data[11]);
		$place = 'place/' .str_replace(' ', '_', $country). '/' .str_replace(' ', '_', $state). '/' .str_replace(' ', '_', $city);

        $txt = '(1, "' .$city. '", "' .$state. '", "' .$country. '", "' .$place. '", "' .$latitude. '", "' .$longitude. '"), ' ."\n";
		fwrite($fp, $txt);
    }

    if (!feof($handle)) {
        echo "Error: unexpected fgets() fail\n";
    }

    fclose($handle);
	fclose($fp);
}

// http://www.yr.no/place/Andorra/Encamp/Vila/forecast.xml
$reg = '/^.*\.no\/place\/(.*)\/(.*)\/(.*)\/.*$/';
$inserted_geoids = array();

$fp = fopen('Inserts.txt', 'a');
$handle = @fopen('verda.txt', 'r');
if ($handle) {
	$line = 0;
    while (($buffer = fgetcsv($handle, 1024, "\t")) !== false) {
		$line++;

		// skip US cities
		if (trim($buffer[0]) == 'US') { continue; }

		$geoid = trim($buffer[4]);
		if (!preg_match($reg, $buffer[17], $data)) { echo 'Line ' .$line. ' does not match regex<br/>'; continue; }
		if (in_array($geoid, $inserted_geoids)) { echo $geoid. ' already inserted<br/>'; continue; }

		$city = trim($data[3]);
		if (strpos($city, ',') !== FALSE) {
			echo 'Line ' .$line. ' fixing city "' .$city. '"<br/>';
			$city = substr($city, 0, strpos($city, ','));
		}
		if (strpos($city, '~') !== FALSE) {
			echo 'Line ' .$line. ' fixing city "' .$city. '"<br/>';
			$city = substr($city, 0, strpos($city, '~'));
		}
		$state = trim($data[2]);
		$country = trim($data[1]);

		$latitude = trim($buffer[12]);
		$longitude = trim($buffer[13]);
		$place = 'place/' .str_replace(' ', '_', $country). '/' .str_replace(' ', '_', $state). '/' .str_replace(' ', '_', $city);

        $txt = '(2, "' .str_replace('_', ' ', $city). '", "' .str_replace('_', ' ', $state). '", "' .str_replace('_', ' ', $country). '", "' .$place. '", "' .$latitude. '", "' .$longitude. '"), ' ."\n";
		fwrite($fp, $txt);

		$inserted_geoids[] = $geoid;
    }

    if (!feof($handle)) {
        echo "Error: unexpected fgets() fail\n";
    }

    fclose($handle);
	fwrite($fp, ';');
	fclose($fp);
} 

?>
</body>
</html>
