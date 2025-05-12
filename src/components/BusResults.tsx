import React, { useEffect, useState } from 'react';
import BusCard from './Buscard';
import { Bus } from '../types';

interface BusResultsProps {
  searchQuery?: Bus[] | any; // Allow any type to prevent type errors
  onBook: (busId: number) => void;
}

const BusResults: React.FC<BusResultsProps> = ({ searchQuery, onBook }) => {
  console.log("real;nvaos", searchQuery, "sadf", typeof searchQuery);

  const [busData, setBusData] = useState<Bus[]>([]);
  console.log("BusResults initial busData:", busData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log("BusResults - received searchQuery:", 
      typeof searchQuery, 
      Array.isArray(searchQuery) ? `array[${searchQuery.length}]` : "not array");
    
    // Reset states
    setLoading(true);
    setError(null);
    
    if (!searchQuery) {
      setError("No bus data provided");
      setLoading(false);
      return;
    }
    
    try {
      // 1. Handle if it's already the correct format
      if (Array.isArray(searchQuery) && 
          searchQuery.length > 0 && 
          typeof searchQuery[0] === 'object' &&
          'tripID' in searchQuery[0]) {
        console.log("Direct array format detected");
        setBusData(searchQuery);
        setLoading(false);
        return;
      }

      // 2. Check if it's already an array but might need conversion
      if (Array.isArray(searchQuery)) {
        const validBusObjects = searchQuery.map(item => {
          // If the item is an object with tripID, use it directly
          if (typeof item === 'object' && item !== null && 'tripID' in item) {
            return item;
          }
          
          // If it's a string, try to parse it
          if (typeof item === 'string') {
            try {
              const parsed = JSON.parse(item);
              if (typeof parsed === 'object' && 'tripID' in parsed) {
                return parsed;
              }
            } catch (e) {
              // Ignore parsing errors for individual items
            }
          }
          
          return null;
        }).filter(Boolean);
        
        if (validBusObjects.length > 0) {
          console.log("Converted array items to bus objects");
          setBusData(validBusObjects);
          setLoading(false);
          return;
        }
      }

      // 3. Try to directly use searchQuery as an array of bus objects
      // This handles the case where searchQuery is a complete array of bus objects
      // but TypeScript doesn't recognize it as such
      if (typeof searchQuery === 'object' && searchQuery !== null) {
        const directArray = Array.isArray(searchQuery) ? searchQuery : [searchQuery];
        const validBuses = directArray.filter(item => 
          typeof item === 'object' && 
          item !== null && 
          'tripID' in item
        );
        
        if (validBuses.length > 0) {
          console.log("Using searchQuery directly as bus data");
          setBusData(validBuses);
          setLoading(false);
          return;
        }
      }

      // 4. If searchQuery is a string that looks like JSON
      if (typeof searchQuery === 'string' && 
          (searchQuery.startsWith('[') || searchQuery.startsWith('{'))) {
        try {
          const cleaned = searchQuery.replace(/\\"/g, '"'); // Clean up escaped quotes
          const parsed = JSON.parse(cleaned);
          
          if (Array.isArray(parsed) && parsed.length > 0 && 'tripID' in parsed[0]) {
            console.log("Parsed JSON string successfully");
            setBusData(parsed);
            setLoading(false);
            return;
          }
          
          // Check if parsed is an object that contains bus data
          if (typeof parsed === 'object' && parsed !== null) {
            // Try to find an array property that contains bus objects
            for (const key in parsed) {
              if (Array.isArray(parsed[key]) && 
                  parsed[key].length > 0 && 
                  'tripID' in parsed[key][0]) {
                console.log("Found bus array in parsed object");
                setBusData(parsed[key]);
                setLoading(false);
                return;
              }
            }
          }
        } catch (e) {
          console.error("JSON parsing failed:", e);
          // Continue to other methods
        }
      }

      // 5. Special handling - try to manually extract the data
      // Check if searchQuery looks like a string representation of a JSON array
      if (typeof searchQuery === 'string' && searchQuery.includes('"tripID"')) {
        console.log("Using regex extraction for malformed JSON");
        try {
          // Attempt to extract and clean the JSON-like string
          const match = searchQuery.match(/\[\s*\{.*\}\s*\]/s);
          if (match) {
            try {
              const extracted = JSON.parse(match[0]);
              if (Array.isArray(extracted) && extracted.length > 0 && 'tripID' in extracted[0]) {
                console.log("Regex extraction successful");
                setBusData(extracted);
                setLoading(false);
                return;
              }
            } catch (innerError) {
              console.error("Failed to parse extracted data:", innerError);
            }
          }
        } catch (regexError) {
          console.error("Regex extraction failed:", regexError);
        }
      }

      // 6. Last resort - manually convert the data
      console.log("Using manual data extraction as last resort");
      // This is assuming searchQuery might be the exact data you showed in your example
      if (typeof searchQuery === 'string' || Array.isArray(searchQuery)) {
        let dataString = Array.isArray(searchQuery) ? searchQuery[0] : searchQuery;
        
        if (typeof dataString === 'string' && dataString.includes('"tripID"')) {
          // Extract just the basic info we need for BusCard
          const tripIDMatch = /"tripID":\s*(\d+)/.exec(dataString);
          const fromMatch = /"from":\s*"([^"]+)"/.exec(dataString);
          const toMatch = /"to":\s*"([^"]+)"/.exec(dataString);
          const ratingMatch = /"rating":\s*([\d.]+)/.exec(dataString);
          const durationMatch = /"duration":\s*"([^"]+)"/.exec(dataString);
          
          if (tripIDMatch && fromMatch && toMatch) {
            const manualBus = {
              tripID: parseInt(tripIDMatch[1], 10),
              from: fromMatch[1],
              to: toMatch[1],
              rating: ratingMatch ? parseFloat(ratingMatch[1]) : 0,
              duration: durationMatch ? durationMatch[1] : "",
              startTime: "", // Placeholder value
              endTime: "", // Placeholder value
              allBoardingPoints: [], // Placeholder value
              allDroppingPoints: [], // Placeholder value
              recommended_seats: [], // Replace with a valid RecommendedSeats value if available
            };
            
            console.log("Manually extracted bus data:", manualBus);
            setBusData([manualBus as Bus]); // Cast manualBus to Bus if all required properties are valid
            setLoading(false);
            return;
          }
        }
      }

      // If we got here, we couldn't parse the data
      console.error("No valid bus data format found in:", searchQuery);
      setError("Invalid bus data format");
    } catch (err) {
      console.error("Error processing bus results:", err);
      setError("Error processing bus data");
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  // Handle loading state
  if (loading) {
    return <p className="text-center text-gray-500">Loading buses...</p>;
  }

  // Handle error state
  if (error) {
    return <p className="text-center text-red-500">Error: {error}</p>;
  }

  // Handle no data case
  if (busData.length === 0) {
    return <p className="text-center text-gray-500">No buses found for the given query.</p>;
  }

  // Render bus cards
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-2">
      {busData.map((bus) => (
        <BusCard key={bus.tripID} bus={bus} onBook={onBook} />
      ))}
    </div>
  );
};

export default BusResults;