import React, { useEffect, useState } from 'react';
import BusCard from './Buscard';
import { Bus, Passenger, BusQueryResponse } from '../types/chat';
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
    if (!Array.isArray(buses)) return [];
    
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
    const processSearchQuery = async () => {
      setLoading(true);
      setError(null);
      setIsEmptyResponse(false);

      try {
        // Case 1: Direct array of buses
        if (Array.isArray(searchQuery)) {
          setBusData(normalizeData(searchQuery));
          setLoading(false);
          return;
        }

        // Case 2: BusQueryResponse format with recommendations
        if (searchQuery && typeof searchQuery === 'object' && 'recommendations' in searchQuery) {
          if (Array.isArray(searchQuery.recommendations)) {
            if (searchQuery.recommendations.length === 0) {
              setIsEmptyResponse(true);
            }
            setBusData(normalizeData(searchQuery.recommendations));
            setPassengersData(searchQuery.passengers || []);
          }
          setLoading(false);
          return;
        }

        // Case 3: Single bus object
        if (searchQuery && typeof searchQuery === 'object' && 'tripID' in searchQuery) {
          setBusData(normalizeData([searchQuery]));
          setLoading(false);
          return;
        }

        // If we get here, the data format is not recognized
        setBusData([]);
        setError("Could not recognize bus data format");
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

  useEffect(() => {
    console.log("BusResults processed busData:", busData);
    console.log("BusResults processed passengersData:", passengersData);
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