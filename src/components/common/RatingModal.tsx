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
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../services/supabase-client';
import { RATING_SCALES, getRatingScaleKey } from '../../utils/ratingScale';

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
  const { user, refreshUser } = useAuth();
  const scaleKey = getRatingScaleKey(user);
  const scale = RATING_SCALES[scaleKey];
  const isCustom = scale.max === null;

  const [showScalePicker, setShowScalePicker] = useState(false);
  const [savingScale, setSavingScale] = useState(false);

  const [value, setValue] = useState(currentRating);
  // Custom scale types into a plain text field, so keep it as a string.
  const [customValue, setCustomValue] = useState(currentRating ? String(currentRating) : '');

  useEffect(() => {
    setValue(currentRating);
    setCustomValue(currentRating ? String(currentRating) : '');
  }, [currentRating]);

  const handleRatingChange = (event, newValue) => {
    setValue(newValue);
  };

  const customNumber = Number(customValue);
  const customValid = customValue.trim() !== '' && Number.isFinite(customNumber);

  const handleSubmit = () => {
    if (isCustom) {
      if (customValid) {
        onRate(customNumber);
        onClose();
      }
    } else if (value > 0) {
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
    setCustomValue(currentRating ? String(currentRating) : '');
    setShowScalePicker(false);
    onClose();
  };

  // Persist the new scale immediately; refreshUser re-renders the modal
  // with the new star count / input style.
  const handleScaleChange = async (e) => {
    const key = e.target.value;
    setSavingScale(true);
    const { error } = await supabase.auth.updateUser({
      data: { rating_scale: key },
    });
    if (error) {
      console.error(error);
    } else {
      await refreshUser();
    }
    setSavingScale(false);
    setShowScalePicker(false);
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
          {isCustom ? (
            <>
              <input
                type="number"
                step="any"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                autoFocus
                style={{
                  width: 120,
                  padding: '8px 10px',
                  background: '#111',
                  color: 'white',
                  border: '1px solid #666',
                  borderRadius: 6,
                  fontSize: 18,
                  fontWeight: 'bold',
                  textAlign: 'center',
                }}
              />
              <Typography variant="body2" sx={{ mt: 1, color: '#ffffffff' , fontWeight:'bold' }}>
                {customValid ? `${customNumber}` : 'No rating'}
              </Typography>
            </>
          ) : (
            <>
              <StyledRating
                name="movie-rating"
                value={value}
                onChange={handleRatingChange}
                max={scale.max}
                precision={scale.step}
                size="large"
              />
              <Typography variant="body2" sx={{ mt: 1, color: '#ffffffff' , fontWeight:'bold' }}>
                {value ? `${value}/${scale.max}` : 'No rating'}
              </Typography>
            </>
          )}

          {showScalePicker ? (
            <select
              value={scaleKey}
              onChange={handleScaleChange}
              disabled={savingScale}
              autoFocus
              style={{
                marginTop: 8,
                padding: '4px 8px',
                background: '#111',
                color: 'white',
                border: '1px solid #666',
                borderRadius: 6,
                fontSize: 13,
              }}
            >
              {Object.entries(RATING_SCALES).map(([key, s]) => (
                <option key={key} value={key}>
                  {s.label}
                </option>
              ))}
            </select>
          ) : (
            <Button
              size="small"
              onClick={() => setShowScalePicker(true)}
              sx={{
                mt: 1,
                color: '#888',
                textTransform: 'none',
                fontSize: 12,
                '&:hover': { color: '#bbb', backgroundColor: 'transparent' },
              }}
            >
              Change rating scale ({scale.label})
            </Button>
          )}
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
            disabled={isCustom ? !customValid : !value}
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