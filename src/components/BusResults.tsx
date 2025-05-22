import React, { useEffect, useState } from 'react';
import BusCard from './Buscard';
import { Bus, RecommendedPoint, BoardingPoint, DroppingPoint, RecommendedSeats, GenderAssignments, Passenger, BusQueryResponse } from '../types/chat';
import { flattenBusesByCategory } from '../utils/busUtils';

interface BusResultsProps {
  searchQuery?: Bus[] | BusQueryResponse | any;
  onBook: (busId: number) => void;
}

const BusResults: React.FC<BusResultsProps> = ({ searchQuery, onBook }) => {
  const [busData, setBusData] = useState<Bus[]>([]);
  const [passengersData, setPassengersData] = useState<Passenger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEmptyResponse, setIsEmptyResponse] = useState(false);

  // Normalize the bus data to ensure all required properties exist
  const normalizeData = (buses: Bus[]): Bus[] => {
    if (!Array.isArray(buses) || buses.length === 0) return [];
    
    return buses.map(bus => ({
      ...bus,
      allBoardingPoints: bus.allBoardingPoints || [],
      allDroppingPoints: bus.allDroppingPoints || [],
      recommended_boarding_points: bus.recommended_boarding_points || [],
      recommended_dropping_points: bus.recommended_dropping_points || [],
      recommended_seats: bus.recommended_seats || {},
      gender_assignments: bus.gender_assignments || {}
    }));
  };

  // Safely parse JSON with error handling
  const safeJsonParse = (jsonString: string) => {
    try {
      return JSON.parse(jsonString);
    } catch (e) {
      // Try to extract the first valid JSON object or array from the string
      try {
        // Find the first '{' and the matching closing '}' for the main object
        let objStart = jsonString.indexOf('{');
        if (objStart !== -1) {
          let braceCount = 0;
          for (let i = objStart; i < jsonString.length; i++) {
            if (jsonString[i] === '{') braceCount++;
            if (jsonString[i] === '}') braceCount--;
            if (braceCount === 0) {
              const objStr = jsonString.substring(objStart, i + 1);
              return JSON.parse(objStr);
            }
          }
        }
        // Try to extract the first array (if object not found)
        let arrayStart = jsonString.indexOf('[');
        if (arrayStart !== -1) {
          let bracketCount = 0;
          for (let i = arrayStart; i < jsonString.length; i++) {
            if (jsonString[i] === '[') bracketCount++;
            if (jsonString[i] === ']') bracketCount--;
            if (bracketCount === 0) {
              const arrStr = jsonString.substring(arrayStart, i + 1);
              return JSON.parse(arrStr);
            }
          }
        }
      } catch (extractErr) {
        console.error("Failed to extract valid JSON:", extractErr);
        throw e;
      }
      throw e;
    }
  };
  
  // Store the query response in global scope for BusCard to access
  useEffect(() => {
    // Make passengers data globally available
    if (searchQuery && typeof searchQuery === 'object' && searchQuery.passengers) {
      // Store in window object for easy access from other components
      if (typeof window !== 'undefined') {
        (window as any).busQueryResponse = searchQuery;
      }
      setPassengersData(searchQuery.passengers);
    }
  }, [searchQuery]);

  useEffect(() => {
    const processSearchQuery = async () => {
      setLoading(true);
      setError(null);
      setIsEmptyResponse(false);

      // Add a small delay to ensure consistent behavior across browsers
      await new Promise(resolve => setTimeout(resolve, 50));
      
      console.log("Processing searchQuery type:", typeof searchQuery);
      
      if (!searchQuery) {
        setBusData([]);
        setError("No bus data provided");
        setLoading(false);
        return;
      }

      try {
        // Case 1: Handle empty recommendations explicitly
        if (
          typeof searchQuery === 'object' &&
          searchQuery !== null &&
          Array.isArray(searchQuery.recommendations) &&
          searchQuery.recommendations.length === 0
        ) {
          console.log("Empty recommendations detected");
          setIsEmptyResponse(true);
          setBusData([]);
          setLoading(false);
          return;
        }
        
        // Case 2: Handle string that might be empty recommendations
        if (
          typeof searchQuery === 'string' &&
          (searchQuery.includes('"recommendations": []') || 
           searchQuery.includes('"recommendations":[]'))
        ) {
          console.log("Empty recommendations string detected");
          setIsEmptyResponse(true);
          setBusData([]);
          setLoading(false);
          return;
        }

        // Case 3: Handle { recommendations: [...] } format (backend JSON)
        if (
          typeof searchQuery === 'object' &&
          searchQuery !== null &&
          Array.isArray(searchQuery.recommendations) &&
          searchQuery.recommendations.length > 0 &&
          typeof searchQuery.recommendations[0] === 'object' &&
          'tripID' in searchQuery.recommendations[0]
        ) {
          console.log("Processing recommendations array:", searchQuery.recommendations);
          // Save passengers data if available
          if (searchQuery.passengers && Array.isArray(searchQuery.passengers)) {
            setPassengersData(searchQuery.passengers);
          }
          
          setBusData(normalizeData(searchQuery.recommendations));
          setLoading(false);
          return;
        }

        // Case 4: Handle array of bus objects
        if (
          Array.isArray(searchQuery) &&
          searchQuery.length > 0 &&
          typeof searchQuery[0] === 'object' &&
          'tripID' in searchQuery[0]
        ) {
          console.log("Processing bus array:", searchQuery);
          setBusData(normalizeData(searchQuery));
          setLoading(false);
          return;
        }

        // Case 5: Handle stringified JSON (object or array)
        if (
          typeof searchQuery === 'string' &&
          (searchQuery.includes('{') || searchQuery.includes('['))
        ) {
          try {
            // Clean and parse with our safe parsing function
            console.log("Cleaning and parsing JSON string");
            const cleaned = searchQuery.replace(/\\"/g, '"');
            const parsed = safeJsonParse(cleaned);
            console.log("Parsed JSON:", parsed);

            // If parsed is { recommendations: [...] }
            if (
              typeof parsed === 'object' &&
              parsed !== null &&
              Array.isArray(parsed.recommendations)
            ) {
              if (parsed.recommendations.length === 0) {
                console.log("Empty recommendations in parsed object");
                setIsEmptyResponse(true);
                setBusData([]);
                setLoading(false);
                return;
              }
              
              if (
                parsed.recommendations.length > 0 &&
                typeof parsed.recommendations[0] === 'object' &&
                'tripID' in parsed.recommendations[0]
              ) {
                console.log("Found recommendations in parsed object:", parsed.recommendations);
                // Save passengers data if available
                if (parsed.passengers && Array.isArray(parsed.passengers)) {
                  setPassengersData(parsed.passengers);
                }
                
                setBusData(normalizeData(parsed.recommendations));
                setLoading(false);
                return;
              }
            }

            // If parsed is array of bus objects
            if (
              Array.isArray(parsed) &&
              parsed.length > 0 &&
              typeof parsed[0] === 'object' &&
              'tripID' in parsed[0]
            ) {
              console.log("Found bus array in parsed object:", parsed);
              setBusData(normalizeData(parsed));
              setLoading(false);
              return;
            }

            // Try to find an array property that contains bus objects
            if (typeof parsed === 'object' && parsed !== null) {
              for (const key in parsed) {
                if (
                  Array.isArray(parsed[key]) &&
                  parsed[key].length > 0 &&
                  typeof parsed[key][0] === 'object' &&
                  'tripID' in parsed[key][0]
                ) {
                  console.log(`Found bus array in parsed object.${key}:`, parsed[key]);
                  setBusData(normalizeData(parsed[key]));
                  setLoading(false);
                  return;
                }
              }
            }
          } catch (e) { 
            console.error("Error parsing JSON string:", e);
            // Continue to fallback methods
          }
        }

        // Case 6: Fallback to regex extraction
        if (typeof searchQuery === 'string' && searchQuery.includes('"tripID"')) {
          console.log("Attempting regex extraction");
          // Look for JSON arrays
          const arrayMatches = searchQuery.match(/\[\s*\{[^[\]]*\}\s*\]/gs);
          if (arrayMatches) {
            for (const match of arrayMatches) {
              try {
                const extracted = safeJsonParse(match);
                if (
                  Array.isArray(extracted) &&
                  extracted.length > 0 &&
                  typeof extracted[0] === 'object' &&
                  'tripID' in extracted[0]
                ) {
                  console.log("Extracted bus array using regex:", extracted);
                  setBusData(normalizeData(extracted));
                  setLoading(false);
                  return;
                }
              } catch (e) {
                console.error("Failed to parse array match:", e);
                // Try next match
              }
            }
          }
          
          // Try to extract individual bus object properties
          console.log("Attempting manual extraction from string");
          try {
            const tripIDMatch = /"tripID":\s*(\d+)/.exec(searchQuery);
            const fromMatch = /"from":\s*"([^"]+)"/.exec(searchQuery);
            const toMatch = /"to":\s*"([^"]+)"/.exec(searchQuery);
            const ratingMatch = /"rating":\s*([\d.]+)/.exec(searchQuery);
            const durationMatch = /"duration":\s*"([^"]+)"/.exec(searchQuery);
            const startTimeMatch = /"startTime":\s*"([^"]+)"/.exec(searchQuery);
            const endTimeMatch = /"endTime":\s*"([^"]+)"/.exec(searchQuery);

            // Try to extract passengers array
            try {
              const passengersMatch = searchQuery.match(/"passengers"\s*:\s*(\[.*?\])/s);
              if (passengersMatch && passengersMatch[1]) {
                const passengersJson = passengersMatch[1];
                const passengers = JSON.parse(passengersJson);
                if (Array.isArray(passengers)) {
                  setPassengersData(passengers);
                }
              }
            } catch (e) {
              console.error("Failed to parse passengers array:", e);
            }

            if (tripIDMatch && fromMatch && toMatch) {
              console.log("Manual extraction successful");
              
              // Create properly typed empty arrays matching your interfaces
              const allBoardingPoints: BoardingPoint[] = [];
              const allDroppingPoints: DroppingPoint[] = [];
              
              // Create empty arrays with the proper types for recommended points
              const recommended_boarding_points: RecommendedPoint[] = [];
              const recommended_dropping_points: RecommendedPoint[] = [];
              
              // Empty objects for seat and gender data
              const recommended_seats: RecommendedSeats = {};
              const gender_assignments: GenderAssignments = {};
              
              const startTime = startTimeMatch ? startTimeMatch[1] : "";
              const endTime = endTimeMatch ? endTimeMatch[1] : "";

              const manualBus: Bus = {
                tripID: parseInt(tripIDMatch[1], 10),
                from: fromMatch[1],
                to: toMatch[1],
                rating: ratingMatch ? parseFloat(ratingMatch[1]) : 0,
                duration: durationMatch ? durationMatch[1] : "",
                startTime,
                endTime,
                allBoardingPoints,
                allDroppingPoints,
                recommended_boarding_points,
                recommended_dropping_points,
                recommended_seats,
                gender_assignments,
              };
              
              console.log("Manual extraction result:", manualBus);
              setBusData(normalizeData([manualBus]));
              setLoading(false);
              return;
            }
          } catch (regexError) {
            console.error("Error during manual extraction:", regexError);
          }
        }

        // If we reach here, we couldn't extract valid bus data
        console.log("No valid bus data could be extracted");
        setBusData([]);
        setError("Could not find valid bus data in the response");
      } catch (err) {
        console.error("Error processing bus data:", err);
        setBusData([]);
        setError("Error processing bus data");
      } finally {
        setLoading(false);
      }
    };

    processSearchQuery();
  }, [searchQuery]);

  // Add debug logging to see what's in the processed data
  useEffect(() => {
    console.log("BusResults processed busData:", busData);
    console.log("BusResults processed passengersData:", passengersData);
    
    if (busData.length > 0) {
      // Log the first bus data to check its structure
      const firstBus = busData[0];
      console.log("First bus tripID:", firstBus.tripID);
      console.log("First bus from/to:", firstBus.from, "to", firstBus.to);
      console.log("First bus boarding points:", firstBus.allBoardingPoints?.length || 0);
      console.log("First bus dropping points:", firstBus.allDroppingPoints?.length || 0);
      console.log("First bus recommended seats:", firstBus.recommended_seats);
      
      // Log the flattened bus data by category
      const flattenedBuses = flattenBusesByCategory(busData);
      console.log("Flattened buses by category:", flattenedBuses);
      console.log("Number of category-specific bus cards:", flattenedBuses.length);
    }
  }, [busData, passengersData]);

  if (loading) {
    return <p className="text-center text-gray-500">Loading buses...</p>;
  }

  if (isEmptyResponse) {
    return (
      <div className="p-4 border border-yellow-300 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700/50">
        <p className="text-center text-yellow-800 dark:text-yellow-200">
          No bus suggestions found for this route. Please try a different route or date.
        </p>
      </div>
    );
  }

  if (error) {
    return <p className="text-center text-red-500">Error: {error}</p>;
  }

  if (busData.length === 0) {
    return <p className="text-center text-gray-500">No buses found for the given query.</p>;
  }

  // Use flattenBusesByCategory to split buses by category
  const categoryBuses = flattenBusesByCategory(busData);

  // If no buses with valid categories were found
  if (categoryBuses.length === 0) {
    return <p className="text-center text-gray-500">No buses with available seats found.</p>;
  }

  // Add passengers data to each bus object before passing to BusCard
  const categoryBusesWithPassengers = categoryBuses.map(bus => ({
    ...bus,
    passengers: passengersData
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-2">
      {categoryBusesWithPassengers.map((categoryBus) => (
        <BusCard 
          key={`${categoryBus.tripID}-${categoryBus.category}`} 
          bus={categoryBus}
          onBook={onBook}
        />
      ))}
    </div>
  );
};

export default BusResults;