<?

/*
 * Class to access IMAP mailbox
 */

class TWIGWeather {
	protected $db = null;

    function __construct () {
		$this->db = new DB();		
	}

	/*
	 * Search for locations
	 * @param string $location
	 * @return array $locations [{...}, ...]
	 */
	public function searchLocations ($criteria) {
		// basic checks
        if (!is_array($criteria)) { throw new Exception ('Search criteria not specified', 1001); }

        $criteria = $this->db->escape($criteria);
        $where = array();
        if (isset($criteria['city'])) { $where[] = 'city LIKE "' .$criteria['city']. '%"'; }
        if (isset($criteria['state'])) { $where[] = 'state LIKE "' .$criteria['state']. '%"'; }
        if (isset($criteria['country'])) { $where[] = 'country LIKE "' .$criteria['country']. '%"'; }
        if (isset($criteria['place'])) { $where[] = 'yr_no = "' .$criteria['place']. '"'; }
		if (count($where) == 0) { throw new Exception ('Invalid search criteria specified', 1001); }

		$query = 'SELECT city, state, country, yr_no AS place FROM geonames ';
		$query .= 'WHERE ' .implode(' OR ', $where). ' ';
		$query .= 'ORDER BY city, state, country';

		$locations = $this->db->getTable($query);

		return $locations;
	}

	/*
	 * Lists forcast for a given location
	 * @param string $location
	 * @return array $forecast
	 */ 
	public function getForecast ($location) {
		// basic checks
		if (!preg_match('/place\/(.*)\/(.*)\/(.*)/', $location, $matches)) { throw new Exception ('Incorrect location specified', 1001); }

		// run query to verify place
		$matches = $this->db->escape($matches);
		$query = 'SELECT city, state, country, yr_no FROM geonames WHERE country = "' .str_replace('_', ' ', $matches[1]). '" AND state = "' .str_replace('_', ' ', $matches[2]). '" AND city = "' .str_replace('_', ' ', $matches[3]). '"';
		try {
			$result = $this->db->query($query);
			$numrows = $this->db->getNumRows($result);
		} catch (Exception $e) {
			to_log('Error getting location info with query "' .$query. '"');
			throw new Exception ('Error getting location information', 1001);
		}

		if ($numrows != 1) {
			error_log('Did not get 1 row when running query "' .$query. '"');
			throw new Exception ('Error finding location information.', 1001);
		}
		$row = $this->db->getRow($result);

		// get the remote URL and local file fullpath
		$fprefix = str_replace('/', '-', $row['yr_no']);
		$url = 'http://www.yr.no/' .$row['yr_no']. '/forecast.xml';
		$fullpath = SE\BASE_DIR. '/temp/' .$fprefix. '-forecast.json';

		// if existing file does not exist or is older than 30 mins download a new one
		if (!is_file($fullpath) || (time() - filectime($fullpath)) > 1800) {
			try { 
				$this->downloadForecast($url, $fullpath);
			} catch (Exception $e) {
				error_log($e->getMessage());
				throw new Exception ('Error getting forecast data');
			}
		}

		if (is_file($fullpath)) {
			$wdata = json_decode(file_get_contents($fullpath), true);
			return array('forecast'=>$wdata['forecast'], 'sun'=>$wdata['sun'], 'utcoffsetmins'=>$wdata['utcoffsetmins'], 'city'=>$row['city'], 'state'=>$row['state'], 'country'=>$row['country']);
		}

		throw new Exception ('Error reading forecast');
	}

	/*
	 * Downloads data from yr.no
	 * @param string URL to yr.no...location...forecast.xml
	 * @param string fullpath to file
	 */
	protected function downloadForecast($url, $fullpath) {
		// download new data
		$ch = curl_init($url);
		curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
		$data = curl_exec($ch);
		if ($data === false) {
			error_log('Could not download data from "' .$url. '". Error: "' .curl_error($ch). '"');
			throw new Exception ('Could not download data');
		}
		curl_close($ch);

		// convert XML to JSON
		$fxml = new SimpleXMLElement($data);
		if ($fxml === false) {
			error_log('Invalid XML "' .$data. '"'); 
			throw new Exception ('Bad XML');
		}

		$sun = array('rise'=>strval($fxml->sun['rise']), 'set'=>strval($fxml->sun['set']));
		$utcoffsetmins = (string) $fxml->location->timezone['utcoffsetMinutes'];

		$forecast = array();
		foreach ($fxml->forecast->tabular->time as $time) {
		    $period = array();
		    $period['from'] = (string) $time['from'];
		    $period['to'] = (string) $time['to'];
		    $period['description'] = (string) $time->symbol['name'];
			$period['symbol'] = (string) $time->symbol['number'];
			$period['precipitation_mm'] = (string) $time->precipitation['value'];
			$period['wind'] = array();
			$period['wind']['degrees'] = (string) $time->windDirection['deg'];
			$period['wind']['direction'] = (string) $time->windDirection['name'];
			$period['wind']['code'] = (string) $time->windDirection['code'];
			$period['wind']['speed_mps'] = (string) $time->windSpeed['mps'];
			$period['wind']['description'] = (string) $time->windSpeed['name'];
			$period['temperature_celsius'] = (string) $time->temperature['value'];
			$period['pressure_hPa'] = (string) $time->pressure['value'];
			$forecast[] = $period;
		}

		// save data in JSON format
		$data = json_encode(array('sun'=>$sun, 'forecast'=>$forecast, 'utcoffsetmins'=>$utcoffsetmins));
		if (file_put_contents($fullpath, $data) === FALSE) {
			error_log('Could not write data to "' .$fullpath. '"');
			throw new Exception ('Could not catch data'); 
		}

		return true;
	}
}

?>
