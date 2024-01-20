

export const mediaFeature = async (event, context) => {
    try {
      // Your new feature logic goes here
      const response = {
        statusCode: 200,
        body: JSON.stringify({ message: 'New feature is working!' }),
      };
      return response;
    } catch (error) {
      console.error('Error in new feature:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Internal Server Error' }),
      };
    }
  };
  