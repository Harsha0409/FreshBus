import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// Add interface for passenger items
interface Passenger {
  name: string;
  age: number | string;
  gender: string;
  seat: string | number;
}

function PaymentCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [processingStatus, setProcessingStatus] = useState('Processing payment...');
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 5; // Maximum number of retries for pending payments

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const status = searchParams.get('status');

    // For debugging
    console.log('Payment callback params:', { sessionId, status });
    console.log('All search params:', Object.fromEntries([...searchParams]));

    // Get access token - with fallback
    const accessToken = localStorage.getItem('access_token') || sessionStorage.getItem('access_token') || '';

    async function processPayment() {
      try {
        setProcessingStatus('Verifying payment status...');

        if (!sessionId) {
          throw new Error('Session ID is missing from the callback URL');
        }

        // Get order_id from localStorage with fallback to sessionStorage
        const apiOrderId = localStorage.getItem('current_order_id') || sessionStorage.getItem('current_order_id');
        console.log('API Order ID from storage:', apiOrderId);

        if (!apiOrderId) {
          throw new Error('API Order ID not found. The booking may not have been completed properly.');
        }

        // For debugging
        console.log('Using API Order ID for confirmation:', apiOrderId);

        // 1. Confirm payment
        setProcessingStatus(
          `Confirming payment... ${retryCount > 0 ? `(Attempt ${retryCount + 1}/${MAX_RETRIES})` : ''}`
        );
        
        // Use a timeout to ensure we don't get stuck if the fetch takes too long
        const confirmPromise = fetch(
          `/api/tickets/${apiOrderId}/confirm_payment`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        
        // Set a timeout for the fetch
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 10000)
        );
        
        // Race between the fetch and the timeout
        const confirmResp = await Promise.race([confirmPromise, timeoutPromise]) as Response;

        console.log('Confirm payment status:', confirmResp.status);

        if (!confirmResp.ok) {
          const errorText = await confirmResp.text();
          console.error('Confirm payment error:', errorText);
          throw new Error(`Payment confirmation failed: ${confirmResp.status}`);
        }

        const confirmData = await confirmResp.json();
        console.log('Confirm payment data:', confirmData);
        console.log('DEBUG: Backend confirm_payment JSON:', JSON.stringify(confirmData, null, 2));

        // Check payment status
        if (confirmData.status === 2) {
          // Payment is still pending
          if (retryCount < MAX_RETRIES) {
            setProcessingStatus(
              `Payment is being processed. Checking again in 3 seconds... (${retryCount + 1}/${MAX_RETRIES})`
            );
            setRetryCount((prev) => prev + 1);
            setTimeout(processPayment, 3000); // Retry after 3 seconds
            return;
          } else {
            // Max retries reached
            storePaymentData({
              sessionId,
              summary: `⏳ Payment is still being processed. Please check your bookings later or contact support.`,
            });
            setProcessingStatus('Payment processing. Redirecting...');
            setTimeout(() => {
              redirectToChat(sessionId);
            }, 1500);
            return;
          }
        } else if (confirmData.status !== 1) {
          // Payment failed or unknown status
          storePaymentData({
            sessionId,
            summary: `❌ Payment failed with status: ${confirmData.status}. Please try again or contact support.`,
          });
          setProcessingStatus('Payment failed. Redirecting...');
          setTimeout(() => {
            redirectToChat(sessionId);
          }, 1500);
          return;
        }

        // If we get here, payment was successful (status === 1)
        if (confirmData.ticket && confirmData.ticket.detailsId) {
          const detailsId = confirmData.ticket.detailsId;
          console.log('Details ID for ticket details:', detailsId);

          // 2. Get ticket details with the detailsId
          setProcessingStatus('Retrieving ticket details...');
          
          // Set a timeout for the fetch
          const detailsPromise = fetch(
            `/api/tickets/${detailsId}/ticket_details`,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            }
          );
          
          // Race between the fetch and the timeout
          const detailsResp = await Promise.race([
            detailsPromise, 
            new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), 10000))
          ]) as Response;

          console.log('Ticket details status:', detailsResp.status);

          if (!detailsResp.ok) {
            const errorText = await detailsResp.text();
            console.error('Ticket details error:', errorText);
            throw new Error(`Failed to retrieve ticket details: ${detailsResp.status}`);
          }

          const detailsData = await detailsResp.json();
          console.log('Ticket details data:', detailsData);

          try {
            // 3. Format and store ticket data
            const ticket = detailsData.ticketData;
            const passengers = detailsData.passengerData || [];

            // Format times
            const formatTime = (iso: string) =>
              new Date(iso).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              });

            // Create a more attractive summary with all booked seats
            const summary = `
Hurray! Your FreshBus Ticket is confirmed!
Dear Customer,
We’re delighted to have you travel with us!
✅ Bus Type: ${ticket.vehicleType || 'N/A'}
✅ Booking ID: ${ticket.invoiceNumber}
✅ Route: ${ticket.source} - ${ticket.destination}
✅ Reporting:  ${formatTime(ticket.boardingTime)}
✅ Bus Departs at: ${formatTime(ticket.boardingTime)}
✅ Seats: ${passengers.map((p: Passenger) => `${p.seat}(${p.gender[0]})`).join(', ')}


Boarding Point: ${ticket.boardingPoint}
Landmark: ${ticket.boardingLandmark || 'N/A'}
[Boarding Point Location](${ticket.boardingPointUrl || 'N/A'})
Dropping Point: ${ticket.droppingPoint}
Landmark: ${ticket.droppingLandmark || 'N/A'}
[Dropping Point Location](${ticket.droppingPointUrl || 'N/A'})
[Detailed Freshbus Policy](https://www.freshbus.com/terms-and-conditions)
24/7 Helpline:
For further assistance, contact us on 7075511729
Thank you for choosing FreshBus. Stay fresh!
`;            // 4. Store structured data for ticket card display
            storePaymentData({
              sessionId,
              summary,
              ticketData: {
                invoiceNumber: ticket.invoiceNumber,
                source: ticket.source,
                destination: ticket.destination,
                boardingPoint: ticket.boardingPoint,
                boardingTime: ticket.boardingTime,
                droppingPoint: ticket.droppingPoint,
                droppingTime: ticket.droppingTime,
                amount: ticket.totalAmount || ticket.amount
              },
              passengerData: passengers.map((p: Passenger) => ({
                name: p.name,
                age: p.age,
                gender: p.gender,
                seat: p.seat
              }))
            });

            // Clean up the order ID from both storages
            localStorage.removeItem('current_order_id');
            sessionStorage.removeItem('current_order_id');

            setProcessingStatus('Payment successful! Redirecting to chat...');
          } catch (parseError) {
            console.error('Error parsing ticket details:', parseError);
            // Store basic payment success even if details parsing fails
            storePaymentData({
              sessionId,
              summary: `✅ Payment successful! Your booking has been confirmed but we couldn't retrieve the full details.`,
            });
          }
        } else {
          // Payment confirmed but ticket details missing
          console.error('Invalid confirm_payment response:', confirmData);
          storePaymentData({
            sessionId,
            summary:
              '❌ Booking failed: Could not retrieve ticket details. Your payment may still be processing.',
          });
          setProcessingStatus('Warning: Ticket details not found. Redirecting...');
        }
      } catch (error: unknown) {
        console.error('Payment callback error:', error);
        let errorMessage = 'Unknown error occurred';

        if (error instanceof Error) {
          errorMessage = error.message;
        }

        storePaymentData({
          sessionId,
          summary: `❌ Booking failed: ${errorMessage}. If your payment was successful, please contact support.`,
        });
        setProcessingStatus('Error processing payment. Redirecting...');
      }

      // Redirect to chat after short delay
      setTimeout(() => {
        redirectToChat(sessionId);
      }, 1500);
    }

    // Helper function to store data in both localStorage and sessionStorage
    function storePaymentData(data: any) {
      const jsonData = JSON.stringify(data);
      try {
        localStorage.setItem('paymentStatus', jsonData);
      } catch (e) {
        console.error('Error storing in localStorage:', e);
      }
      
      try {
        sessionStorage.setItem('paymentStatus', jsonData);
      } catch (e) {
        console.error('Error storing in sessionStorage:', e);
      }
      
      // Also store in a cookie as a last resort for iOS WebKit
      try {
        document.cookie = `paymentStatus=${encodeURIComponent(jsonData)};path=/;max-age=300`;
      } catch (e) {
        console.error('Error storing in cookie:', e);
      }
    }
    
    // Helper function to navigate to chat
    function redirectToChat(sessionId: string | null) {
      if (sessionId) {
        navigate(`/c/${sessionId}`);
      } else {
        navigate('/');
      }
    }

    processPayment();
    // eslint-disable-next-line
  }, [navigate, retryCount]);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="animate-pulse mb-4">
        <svg
          className="w-16 h-16 text-blue-500 dark:text-blue-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Payment Processing</h1>
      <p className="text-gray-600 dark:text-gray-300 text-center">{processingStatus}</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-8">Please do not close this window.</p>
    </div>
  );
}

export default PaymentCallback;