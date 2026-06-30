//unlike the rest of my code in this project, a lot of the code in this file in particular was written using ai, i thought this little component
//would be a good opportunity to test out its capabilities since im importing an external component someone else made anyway, im happy with how it turned out though!

import { useState } from 'react';
import Box from '@mui/material/Box';
import Rating from '@mui/material/Rating';
import Modal from '@mui/material/Modal';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { styled } from '@mui/material/styles';

import { useEffect } from 'react';

const StyledRating = styled(Rating)({
  '& .MuiRating-iconFilled': {
    color: '#ff0000ff',
  },
  '& .MuiRating-iconHover': {
    color: '#ff0000ff',
  },
});

const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: '#1a1a1a',
  color: 'white',
  boxShadow: 24,
  p: 4,
  borderRadius: 2,
  fontWeight:'bold'
};

export default function RatingModal({ open, onClose, onRate, onRemove, currentRating = 0, movieTitle, isRated = false }) {
  const [value, setValue] = useState(currentRating);

  useEffect(() => {
    setValue(currentRating);
  }, [currentRating]);

  const handleRatingChange = (event, newValue) => {
    setValue(newValue);
  };

  const handleSubmit = () => {
    if (value > 0) {
      onRate(value);
      onClose();
    }
  };

  const handleRemove = () => {
    if (onRemove) {
      onRemove();
      onClose();
    }
  };

  const handleClose = () => {
    setValue(currentRating);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      aria-labelledby="rating-modal-title"
    >
      <Box sx={modalStyle}>
        
        <Typography variant="body1" sx={{ mb: 3, textAlign: 'center', fontWeight:'bold' }}>
          {movieTitle}
        </Typography>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
          <StyledRating
            name="movie-rating"
            value={value}
            onChange={handleRatingChange}
            max={10}
            size="large"
          />
          <Typography variant="body2" sx={{ mt: 1, color: '#ffffffff' , fontWeight:'bold' }}>
            {value ? `${value}/10` : 'No rating'}
          </Typography>
        </Box>
        
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between', alignItems:'center' }}>
          <Box sx={{ display: 'flex', gap: 1}}>
            <Button 
              variant="outlined" 
              onClick={handleClose}
              sx={{ 
                color: 'white', 
                borderColor: '#666',
                '&:hover': { borderColor: '#888' },
                fontWeight:'bold',
                textTransform: 'none'
              }}
            >
              Cancel
            </Button>
            
            {isRated && (
              <Button 
                variant="outlined" 
                onClick={handleRemove}
                sx={{ 
                  color: '#ff0000ff', 
                  borderColor: '#ff0000ff',
                  '&:hover': { 
                    borderColor: '#ff5252',
                    backgroundColor: 'rgba(255, 107, 107, 0.1)' 
                  },
                  fontWeight:'bold',
                  textTransform: 'none'
                }}
              >
                Remove Rating
              </Button>
            )}
          </Box>
          
          <Button 
            variant="contained" 
            onClick={handleSubmit}
            disabled={!value}
            sx={{ 
              backgroundColor: '#ff0000ff',
              '&:hover': { backgroundColor: '#cc0000' },
              fontWeight:'bold',
              textTransform: 'none',
            }}
          >
            {isRated ? 'Update' : 'Rate'}
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}