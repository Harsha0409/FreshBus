import React, { useEffect, useState } from 'react';
import BusCard from './Buscard';
import { Bus } from '../types/chat';
import { flattenBusesByCategory } from '../utils/busUtils';

interface BusResultsProps {
  searchQuery?: Bus[] | any;
  onBook: (busId: number) => void;
}

const BusResults: React.FC<BusResultsProps> = ({ searchQuery, onBook }) => {
  const [busData, setBusData] = useState<Bus[]>([]);
  console.log("BusResults searchQuery:", searchQuery);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Normalize the bus data to ensure all required properties exist
  const normalizeData = (buses: Bus[]): Bus[] => {
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

  useEffect(() => {
    setLoading(true);
    setError(null);

    if (!searchQuery) {
      setBusData([]);
      setError("No bus data provided");
      setLoading(false);
      return;
    }

    try {
      // 1. Handle { recommendations: [...] } format (backend JSON)
      if (
        typeof searchQuery === 'object' &&
        searchQuery !== null &&
        Array.isArray(searchQuery.recommendations) &&
        searchQuery.recommendations.length > 0 &&
        typeof searchQuery.recommendations[0] === 'object' &&
        'tripID' in searchQuery.recommendations[0]
      ) {
        console.log("Processing recommendations array:", searchQuery.recommendations);
        setBusData(normalizeData(searchQuery.recommendations));
        setLoading(false);
        return;
      }

      // 2. Handle array of bus objects
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

      // 3. Handle stringified JSON (object or array)
      if (
        typeof searchQuery === 'string' &&
        (searchQuery.startsWith('{') || searchQuery.startsWith('['))
      ) {
        try {
          const cleaned = searchQuery.replace(/\\"/g, '"');
          console.log("Cleaning and parsing JSON string");
          const parsed = JSON.parse(cleaned);
          console.log("Parsed JSON:", parsed);

          // If parsed is { recommendations: [...] }
          if (
            typeof parsed === 'object' &&
            parsed !== null &&
            Array.isArray(parsed.recommendations) &&
            parsed.recommendations.length > 0 &&
            typeof parsed.recommendations[0] === 'object' &&
            'tripID' in parsed.recommendations[0]
          ) {
            console.log("Found recommendations in parsed object:", parsed.recommendations);
            setBusData(normalizeData(parsed.recommendations));
            setLoading(false);
            return;
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
        }
      }

      // 4. Fallback: Try to extract JSON array from string using regex
      if (typeof searchQuery === 'string' && searchQuery.includes('"tripID"')) {
        console.log("Attempting regex extraction");
        const match = searchQuery.match(/\[\s*\{.*\}\s*\]/s);
        if (match) {
          try {
            const extracted = JSON.parse(match[0]);
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
            console.error("Error parsing extracted JSON:", e);
          }
        }
      }

      // 5. Last resort: manual minimal extraction (not recommended, but kept for completeness)
      if (typeof searchQuery === 'string' || Array.isArray(searchQuery)) {
        let dataString = Array.isArray(searchQuery) ? searchQuery[0] : searchQuery;
        console.log("Attempting manual extraction from string");

        if (typeof dataString === 'string' && dataString.includes('"tripID"')) {
          const tripIDMatch = /"tripID":\s*(\d+)/.exec(dataString);
          const fromMatch = /"from":\s*"([^"]+)"/.exec(dataString);
          const toMatch = /"to":\s*"([^"]+)"/.exec(dataString);
          const ratingMatch = /"rating":\s*([\d.]+)/.exec(dataString);
          const durationMatch = /"duration":\s*"([^"]+)"/.exec(dataString);
          const startTimeMatch = /"startTime":\s*"([^"]+)"/.exec(dataString);
          const endTimeMatch = /"endTime":\s*"([^"]+)"/.exec(dataString);

          if (tripIDMatch && fromMatch && toMatch) {
            console.log("Performing manual extraction");
            let allBoardingPoints = [];
            let allDroppingPoints = [];
            let recommended_boarding_points = [];
            let recommended_dropping_points = [];
            let recommended_seats = {};
            let gender_assignments = {};
            let startTime = startTimeMatch ? startTimeMatch[1] : "";
            let endTime = endTimeMatch ? endTimeMatch[1] : "";

            try {
              // Try to parse the string as JSON and extract the first bus object
              const parsed = JSON.parse(dataString);
              const busObj = Array.isArray(parsed.recommendations)
                ? parsed.recommendations[0]
                : Array.isArray(parsed)
                  ? parsed[0]
                  : parsed;

              console.log("Manual extraction - bus object:", busObj);
              allBoardingPoints = busObj.allBoardingPoints || [];
              allDroppingPoints = busObj.allDroppingPoints || [];
              recommended_boarding_points = busObj.recommended_boarding_points || [];
              recommended_dropping_points = busObj.recommended_dropping_points || [];
              recommended_seats = busObj.recommended_seats || {};
              gender_assignments = busObj.gender_assignments || {};
              startTime = busObj.startTime || startTime;
              endTime = busObj.endTime || endTime;
            } catch (e) {
              console.error("Error during manual extraction:", e);
              // fallback: leave as empty arrays/objects
            }

            const manualBus = {
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
            setBusData(normalizeData([manualBus as Bus]));
            setLoading(false);
            return;
          }
        }
      }

      setBusData([]);
      setError("Try to change the format of the text");
    } catch (err) {
      console.error("Error processing bus data:", err);
      setBusData([]);
      setError("Error processing bus data");
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  // Add debug logging to see what's in the processed data
  useEffect(() => {
    console.log("BusResults processed busData:", busData);
    
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
  }, [busData]);

  if (loading) {
    return <p className="text-center text-gray-500">Loading buses...</p>;
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-2">
      {categoryBuses.map((categoryBus) => (
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